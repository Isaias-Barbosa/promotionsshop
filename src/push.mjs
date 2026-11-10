import { randomUUID, timingSafeEqual } from 'node:crypto';
import { neon } from '@neondatabase/serverless';
import webpush from 'web-push';
import { getDiscounts } from './worker.mjs';

const response = (body,status = 200) => Response.json(body,{status,headers:{'Cache-Control':'no-store'}});
const pushProviders = ['fcm.googleapis.com','updates.push.services.mozilla.com','push.apple.com','notify.windows.com'];

function subscriptionData(data) {
  if (typeof data?.endpoint !== 'string' || data.endpoint.length > 2048) return null;
  const url = URL.parse(data.endpoint);
  if (!url || url.protocol !== 'https:' || url.port || url.username || url.password || url.hash ||
      !pushProviders.some(host => url.hostname === host || url.hostname.endsWith('.' + host))) return null;
  const {p256dh,auth} = data.keys || {};
  const validKey = (value,length) => typeof value === 'string' && /^[A-Za-z0-9_-]+$/.test(value) &&
    Buffer.from(value,'base64url').length === length;
  if (!validKey(p256dh,65) || Buffer.from(p256dh,'base64url')[0] !== 4 || !validKey(auth,16)) return null;
  return {endpoint:url.href,p256dh,auth};
}

function configuration(env) {
  const {DATABASE_URL,VAPID_PUBLIC_KEY,VAPID_PRIVATE_KEY,VAPID_SUBJECT} = env;
  if (!DATABASE_URL || !VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY || !VAPID_SUBJECT) return null;
  return {sql:neon(DATABASE_URL),vapidDetails:{subject:VAPID_SUBJECT,publicKey:VAPID_PUBLIC_KEY,privateKey:VAPID_PRIVATE_KEY}};
}

export async function handlePush(request,env = process.env) {
  try {
    const config = configuration(env);
    if (request.method === 'GET') return response({enabled:!!config,publicKey:config?.vapidDetails.publicKey});
    if (!['POST','DELETE'].includes(request.method)) return response({error:'Método inválido'},405);
    if (request.headers.get('origin') !== new URL(request.url).origin ||
        request.headers.get('content-type')?.split(';')[0] !== 'application/json') {
      return response({error:'Origem inválida'},403);
    }
    if (!config) return response({error:'Notificações indisponíveis'},503);
    const raw = await request.text();
    if (raw.length > 4096) return response({error:'Inscrição inválida'},400);
    let data;
    try { data = subscriptionData(JSON.parse(raw)); } catch {}
    if (!data) return response({error:'Inscrição inválida'},400);
    const {sql} = config;
    const {endpoint,p256dh,auth} = data;
    if (request.method === 'DELETE') {
      await sql`DELETE FROM coupon_push_subscriptions WHERE endpoint = ${endpoint} AND auth = ${auth}`;
    } else {
      await sql`
        INSERT INTO coupon_push_subscriptions (endpoint,p256dh,auth,last_event)
        SELECT ${endpoint},${p256dh},${auth},COALESCE(MAX(id),0) FROM coupon_push_events
        ON CONFLICT (endpoint) DO UPDATE SET p256dh = EXCLUDED.p256dh, auth = EXCLUDED.auth
        WHERE coupon_push_subscriptions.auth = EXCLUDED.auth
      `;
    }
    return response({ok:true});
  } catch {
    console.error('coupon_push_subscription_failed');
    return response({error:'Não foi possível salvar a preferência'},500);
  }
}

function authorized(request, secret) {
  if (!secret || secret.length < 16) return false;
  const expected = Buffer.from('Bearer ' + secret);
  const provided = Buffer.from(request.headers.get('authorization') || '');
  return expected.length === provided.length && timingSafeEqual(expected,provided);
}

async function pendingSubscriptions(sql) {
  return sql`
    WITH pending AS (
      SELECT s.endpoint, digest.last_id, digest.total
      FROM coupon_push_subscriptions s
      CROSS JOIN LATERAL (
        SELECT MAX(id) AS last_id, COUNT(*) AS total
        FROM coupon_push_events
        WHERE id > s.last_event AND expires_at > now()
      ) digest
      WHERE digest.last_id IS NOT NULL
      ORDER BY s.last_attempt_at NULLS FIRST, s.endpoint
      LIMIT 60
    )
    UPDATE coupon_push_subscriptions s SET last_attempt_at = now()
    FROM pending
    WHERE s.endpoint = pending.endpoint
    RETURNING s.endpoint,s.p256dh,s.auth,pending.last_id,pending.total
  `;
}

async function deliver(sql,vapidDetails,subscription) {
  const {endpoint,p256dh,auth,last_id,total} = subscription;
  try {
    await webpush.sendNotification(
      {endpoint,keys:{p256dh,auth}},
      JSON.stringify({count:Number(total),lastEvent:String(last_id)}),
      {vapidDetails,TTL:21600,timeout:5000},
    );
  } catch (error) {
    if (error.statusCode === 404 || error.statusCode === 410) {
      await sql`DELETE FROM coupon_push_subscriptions WHERE endpoint = ${endpoint} AND auth = ${auth}`;
      return 'removed';
    }
    return 'failed';
  }
  await sql`
    UPDATE coupon_push_subscriptions SET last_event = GREATEST(last_event,${last_id})
    WHERE endpoint = ${endpoint} AND auth = ${auth}
  `;
  return 'sent';
}

export async function handleCouponCron(request,env = process.env) {
  if (request.method !== 'GET') return response({error:'Método inválido'},405);
  if (!authorized(request,env.CRON_SECRET)) return response({error:'Não autorizado'},401);
  let sql, token;
  try {
    const config = configuration(env);
    if (!config) return response({error:'Notificações indisponíveis'},503);
    ({sql} = config);
    const lease = randomUUID();
    const lock = await sql`
      INSERT INTO coupon_push_lock (id,token,expires_at) VALUES (true,${lease},now() + interval '2 minutes')
      ON CONFLICT (id) DO UPDATE SET token = EXCLUDED.token, expires_at = EXCLUDED.expires_at
      WHERE coupon_push_lock.expires_at <= now()
      RETURNING token
    `;
    if (!lock.length) return response({skipped:true});
    token = lease;

    const {coupons} = await getDiscounts();
    const snapshot = coupons.map(coupon => ({
      source:coupon.source || 'Americanas',store:coupon.store,code:coupon.code,expires_at:coupon.expires,
    }));
    const [{added}] = await sql`SELECT sync_coupon_push_events(${JSON.stringify(snapshot)}::jsonb) AS added`;
    const pending = await pendingSubscriptions(sql);
    const stats = {added,sent:0,removed:0,failed:0};
    for (let i = 0; i < pending.length; i += 10) {
      const batch = await Promise.allSettled(pending.slice(i,i+10).map(subscription => deliver(sql,config.vapidDetails,subscription)));
      for (const result of batch) stats[result.status === 'fulfilled' ? result.value : 'failed']++;
    }
    if (stats.failed) console.warn('coupon_push_delivery_failures',stats.failed);
    return response(stats);
  } catch {
    console.error('coupon_push_cron_failed');
    return response({error:'Falha ao verificar novos cupons'},500);
  } finally {
    if (token) {
      try { await sql`DELETE FROM coupon_push_lock WHERE token = ${token}`; }
      catch { console.error('coupon_push_lease_release_failed'); }
    }
  }
}
