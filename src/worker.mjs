import { stores, searchStores, seedCoupons } from './stores.mjs';
import { featured, buildProductCard, buildSearchCards, productColor } from './featured.mjs';

const fetchHeaders = { 'accept-language': 'pt-BR,pt;q=0.9', 'accept': 'text/html,application/json' };
const safeUrl = (value, base) => {
  if (typeof value !== "string" || !value.trim()) return null;
  try {
    const url = base ? new URL(value, base) : new URL(value);
    return url.protocol === 'https:' && !url.username && !url.password && !url.hostname.endsWith('.local') ? url.href : null;
  } catch { return null; }
};
const plain = value => String(value || '').replace(/<[^>]+>/g,' ').replace(/&(?:nbsp|amp|quot|apos|lt|gt|#\d+|#x[\da-f]+);/gi, entity => {
  const named = {'&nbsp;':' ','&amp;':'&','&quot;':'"','&apos;':"'",'&lt;':'<','&gt;':'>'};
  const code = entity.startsWith('&#x') ? parseInt(entity.slice(3,-1),16) : Number(entity.slice(2,-1));
  return named[entity] ?? (Number.isInteger(code) && code > 0 && code <= 0x10ffff ? String.fromCodePoint(code) : ' ');
}).replace(/\s+/g,' ').trim();
const normalize = value => value.normalize('NFD').replace(/\p{Diacritic}/gu,'').toLowerCase().replace(/(\d)\s+(gb|tb|cm|mm|ml|kg|mg|g|l|v|w)\b/g,'$1$2').replace(/[^a-z0-9]+/g,' ').trim();
const canonicalSearchQuery = value => value.replace(/\bmicro[\s\p{Pd}]*ondas\b/giu,'micro-ondas');
const normalizeSearch = value => normalize(canonicalSearchQuery(value)).replace(/\bmicro ondas\b/g,'microondas');
const microwavePart = /\b(?:tampas?|pratos?|suportes?|pecas?|acessorios?|motores?|fusiveis|fusivel|magnetron|placas?|dobradicas?|puxadores?|marmitas?|potes?|formas?|bandejas?|aneis|anel|resistencias?|lampadas?|armarios?|nichos?|moveis|movel|miniaturas?)\b/;
const microwaveToy = /\b(?:brinquedos?|infantil|faz de conta)\b/;
const noMatchWords = new Set(['a','o','as','os','e','de','do','da','para','com','em','no','na']);
const byName = new Map([...stores,...searchStores].map(store => [normalize(store.name),store]));
byName.set('magazine luiza', stores.find(store => store.id === 'magalu'));
const marketplaces = [
  {store:byName.get('amazon'),domain:'amazon.com.br',aliases:['amazon com br','amazon brasil','amazon br']},
  {store:byName.get('mercado livre'),domain:'mercadolivre.com.br',aliases:['mercado livre brasil','mercado livre br','mercado livre marketplace','mercadolivre','mercadolivre com br']},
  {store:byName.get('casas bahia'),domain:'casasbahia.com.br',aliases:['casasbahia','casas bahia marketplace']},
  {store:byName.get('ponto frio'),domain:'pontofrio.com.br',aliases:['ponto','pontofrio','ponto com br']},
  {store:byName.get('ponto frio'),domain:'ponto.com.br',aliases:[]},
];
for (const {store,aliases} of marketplaces) aliases.forEach(alias => byName.set(alias,store));

function marketplaceForLink(link) {
  const host = new URL(link).hostname;
  return marketplaces.find(({domain}) => host === domain || host.endsWith('.' + domain))?.store;
}

async function upstream(url, timeout = 5500) {
  const response = await fetch(url, {headers:fetchHeaders, signal:AbortSignal.timeout(timeout)});
  if (!response.ok) throw new Error('Fonte indisponível');
  return response;
}

function makeOffer({ title, store, price, url, delivery, condition, image, color, voltage, featuredPage, brand, gtin }) {
  const cleanTitle = plain(title).slice(0,250);
  const link = safeUrl(url);
  const amount = Number(price);
  if (!link || !cleanTitle || !Number.isFinite(amount) || amount <= 0) return null;
  const label = plain(store).slice(0,100);
  const directMarketplace = marketplaceForLink(link);
  const recognized = directMarketplace || byName.get(normalize(label));
  if (!label && !recognized) return null;
  return {title:cleanTitle,store:recognized?.name || label,storeId:recognized?.id,price:amount,url:link,image:safeUrl(image),color:color || null,voltage:voltage || null,featuredPage:!!featuredPage,brand:plain(brand).slice(0,80),gtin:typeof gtin === 'string' && /^(?:\d{8}|\d{12,14})$/.test(gtin) ? gtin : null,delivery:plain(delivery).slice(0,100),condition:plain(condition).slice(0,80)};
}

async function shopping(query, key) {
  const endpoint = 'https://serpapi.com/search.json?' + new URLSearchParams({engine:'google_shopping',q:query,gl:'br',hl:'pt',google_domain:'google.com.br',api_key:key});
  const data = await (await upstream(endpoint,8500)).json();
  if (data.error && !/hasn.t returned any results/i.test(data.error)) throw new Error('Busca indisponível');
  return [...(data.shopping_results || []), ...(data.inline_shopping_results || [])].flatMap(item => {
    if (!/^R\$\s*[\d.,]+$/i.test(plain(item.price))) return [];
    const url = [item.link,item.product_link].map(value => safeUrl(value)).find(Boolean);
    return [makeOffer({title:item.title,store:item.source,price:item.extracted_price,url,image:item.thumbnail,delivery:item.delivery,condition:item.second_hand_condition})];
  }).filter(Boolean);
}

async function vtex(query, origin, store, intelligent = false) {
  const url = new URL(intelligent ? '/api/io/_v/api/intelligent-search/product_search/' : '/api/catalog_system/pub/products/search',origin);
  url.search = new URLSearchParams(intelligent ? {query,count:'12',locale:'pt-BR'} : {ft:query,_from:'0',_to:'11'});
  const payload = await (await upstream(url)).json();
  const data = intelligent ? payload.products : payload;
  if (!Array.isArray(data)) throw new Error('Catálogo indisponível');
  return data.slice(0,12).flatMap(product => {
    const url = safeUrl(product.link,origin);
    return (product.items || []).flatMap(item => {
      const seller = (item.sellers || []).find(seller => seller.commertialOffer?.AvailableQuantity > 0 && seller.commertialOffer.Price > 0);
      if (!seller || !url) return [];
      const link = new URL(url);
      if (item.itemId) link.searchParams.set('skuId',item.itemId);
      const variant = item.name && normalize(item.name) !== normalize(product.productName || '') ? ' · ' + item.name : '';
      return [makeOffer({title:product.productName + variant + ' ' + (item.variations || []).flatMap(field => Array.isArray(item[field]) ? item[field] : []).join(' '),store,price:seller.commertialOffer.Price,url:link.href,image:safeUrl(item.images?.[0]?.imageUrl,origin),brand:product.brand,gtin:item.ean})];
    });
  }).filter(Boolean);
}

// Public storefront catalog identified in gglucche/radar-ofertas (MIT).
async function kabum(query) {
  const url = new URL('https://servicespub.prod.api.aws.grupokabum.com.br/catalog/v2/products');
  url.search = new URLSearchParams({query,page_number:'1',page_size:'20'});
  const payload = await (await upstream(url)).json();
  if (!Array.isArray(payload.data)) throw new Error('Catálogo KaBuM! indisponível');
  return payload.data.flatMap(item => {
    const product = item.attributes;
    const id = String(item.id);
    if (!product || product.available !== true || !/^\d+$/.test(id)) return [];
    const offer = makeOffer({
      title:product.title,store:'KaBuM!',price:product.offer?.price_with_discount ?? product.price_with_discount ?? product.price,
      url:'https://www.kabum.com.br/produto/' + id + '/' + encodeURIComponent(product.product_link || ''),
      image:productImage(product.images,'https://www.kabum.com.br/'),brand:product.brand?.name || (typeof product.brand === 'string' ? product.brand : null),gtin:product.ean,
    });
    return offer ? [offer] : [];
  });
}

function schemaProducts(source) {
  const products = [];
  function visit(value) {
    if (!value || typeof value !== 'object') return;
    if (Array.isArray(value)) { value.forEach(visit); return; }
    if ([value['@type']].flat().includes('Product')) products.push(value);
    for (const key of ['@graph','itemListElement','item','mainEntity']) visit(value[key]);
  }
  for (const [, raw] of source.matchAll(/<script\b[^>]*\btype=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)) {
    try { visit(JSON.parse(raw)); } catch { /* Ignore unrelated or invalid schema blocks. */ }
  }
  return products;
}

function productImage(value, origin) {
  const image = [value].flat().find(Boolean);
  return safeUrl(typeof image === 'object' ? image?.url || image?.contentUrl : image, origin);
}

function metaContent(source, field) {
  for (const [tag] of source.matchAll(/<meta\b[^>]*>/gi)) {
    const property = tag.match(/\b(?:property|name)=["']([^"']+)["']/i)?.[1];
    if (property === field) return plain(tag.match(/\bcontent=["']([^"']+)["']/i)?.[1]);
  }
  return '';
}

async function findVariantPhoto(variant) {
  if (variant.image) return variant;
  const offer = variant.offers.find(row => row.storeId === 'havan' && new URL(row.url).hostname === 'www.havan.com.br');
  if (!offer) return variant;
  try {
    const response = await upstream(offer.url,3500);
    const page = await response.text();
    const image = safeUrl(metaContent(page,'og:image'),offer.url);
    return image ? {...variant,image} : variant;
  } catch {
    return variant;
  }
}

async function listedProduct([store, url, color, voltage], product) {
  const response = await upstream(url,5000);
  const final = new URL(response.url || url);
  if (final.hostname !== new URL(url).hostname) return [];
  const result = await response.text();
  const matching = schemaProducts(result).filter(item => product.model.test(normalize(plain([item.name,item.sku,item.mpn].filter(Boolean).join(' ')))));
  return matching.flatMap(item => [item.offers].flat().filter(Boolean).flatMap(offer => {
    if (offer.priceCurrency !== 'BRL' || !/\/(?:InStock|LimitedAvailability)$/i.test(offer.availability || '')) return [];
    const itemUrl = safeUrl(offer.url || item.url,final.href);
    if (itemUrl && new URL(itemUrl).hostname !== final.hostname) return [];
    const listedColor = typeof item.color === 'string' ? normalize(item.color) : '';
    const declaredColor = listedColor ? productColor(listedColor) : null;
    if (color && declaredColor && color !== declaredColor) return [];
    const entry = makeOffer({
      title:item.name,store,price:offer.price,url:final.href,image:productImage(item.image,final.href) || safeUrl(metaContent(result,'og:image'),final.href),
      color:declaredColor || color,voltage,featuredPage:true,
    });
    return entry ? [entry] : [];
  }));
}

async function structuredStoreSearch(query, store) {
  const slug = encodeURIComponent(query.toLowerCase().replace(/\s+/g,'-'));
  const url = store.search.replace('{slug}',slug);
  const page = await upstream(url,4000);
  const origin = new URL(url);
  const html = await page.text();
  const products = schemaProducts(html);
  if (!products.length) throw new Error('Vitrine sem dados de produto estruturados');
  return products.slice(0,24).flatMap(product => [product.offers].flat().filter(Boolean).flatMap(item => {
    if (item.priceCurrency !== 'BRL' || !/\/(?:InStock|LimitedAvailability)$/i.test(item.availability || '')) return [];
    const href = safeUrl(item.url || product.url,origin);
    if (!href || marketplaceForLink(href)?.id !== store.id || !new URL(href).pathname.includes('/p/')) return [];
    const offer = makeOffer({
      title:product.name,store:store.name,price:item.price,url:href,image:productImage(product.image,origin),
      brand:typeof product.brand === 'string' ? product.brand : product.brand?.name,gtin:product.gtin13 || product.gtin,
    });
    return offer ? [offer] : [];
  }));
}

async function casasBahiaApi(query,key) {
  const url = new URL('https://api.api.sh/casasbahia/v1/search');
  url.searchParams.set('query',query);
  const response = await fetch(url,{headers:{'x-api-key':key,accept:'application/json'},signal:AbortSignal.timeout(5500)});
  if (!response.ok) throw new Error('Catálogo Casas Bahia indisponível');
  const data = await response.json();
  if (!Array.isArray(data.items)) throw new Error('Resposta de catálogo inválida');
  return data.items.flatMap(item => {
    const href = safeUrl(item.url);
    if (!href || marketplaceForLink(href)?.id !== 'casas' || item.currency !== 'BRL' || item.available !== true || item.in_stock === false) return [];
    const offer = makeOffer({title:item.name,store:'Casas Bahia',price:item.price,url:href,image:item.image,brand:item.brand});
    return offer ? [offer] : [];
  });
}

async function havan(query) {
  const store = stores.find(item => item.id === 'havan');
  const origin = 'https://www.havan.com.br';
  const result = await (await upstream(store.search.replace('{q}',encodeURIComponent(query)))).text();
  const offers = schemaProducts(result).flatMap(item => [item.offers].flat().filter(Boolean).map(offer =>
    offer.priceCurrency === 'BRL' && !/outofstock|soldout|discontinued/i.test(offer.availability || '')
      ? makeOffer({title:item.name,store:store.name,price:offer.price,url:safeUrl(offer.url || item.url,origin),image:productImage(item.image,origin),brand:item.brand?.name || (typeof item.brand === 'string' ? item.brand : null),gtin:item.gtin13 || item.gtin})
      : null
  )).filter(Boolean);
  for (const part of result.split(/<li\b[^>]*\bproduct-item\b[^>]*>/i).slice(1,31)) {
    const name = part.match(/<a\b([^>]*\bproduct-item-link\b[^>]*)>([\s\S]*?)<\/a>/i);
    const url = name?.[1].match(/\bhref\s*=\s*["']([^"']+)/i)?.[1];
    const price = part.match(/data-price-amount=["']([\d.]+)["'][^>]*data-price-type=["']finalPrice["']/i)?.[1];
    const img = part.match(/<img\b[^>]*\bproduct-image-photo\b[^>]*>/i)?.[0] || '';
    const image = safeUrl(plain(img.match(/\b(?:data-src|src)=["']([^"']+)/i)?.[1]),origin);
    if (name && url && price && !/class=["'][^"']*stock unavailable/i.test(part)) {
      offers.push(makeOffer({title:name[2],store:store.name,price,url:safeUrl(plain(url),origin),image}));
    }
  }
  if (!offers.some(Boolean) && !/nenhum (?:resultado|produto)|no results|no products/i.test(plain(result))) throw new Error('Catálogo indisponível');
  return offers.filter(Boolean);
}

const months = ['janeiro','fevereiro','marco','abril','maio','junho','julho','agosto','setembro','outubro','novembro','dezembro'];
function parseAmericanasCoupons(source, now) {
  const coupons = [];
  const text = plain(source.replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1>/gi,' '));
  for (const [,code,terms] of text.matchAll(/\b[Cc]upom\s+([A-Z0-9]{4,24})\b((?:(?!\b[Cc]upom\s+[A-Z0-9]{4,24}\b).){0,1100})/g)) {
    const date = terms.match(/(?:vigente|v[aá]lido)\s+at[eé]\s+(?:dia\s+)?(\d{1,2})\s+de\s+([a-zç]+)\s+de\s+(20\d\d)(?!\s+(?:[àa]s|\d{1,2}h))/i);
    const discount = terms.match(/\bdesconto de (R\$\s*\d+(?:,\d{2})?)(?![\d,])/i);
    if (!date || !discount) continue;
    const month = months.indexOf(normalize(date[2]));
    const day = Number(date[1]);
    const validDay = new Date(Date.UTC(Number(date[3]),month,day));
    if (month < 0 || validDay.getUTCDate() !== day || validDay.getUTCMonth() !== month) continue;
    const expires = Date.UTC(Number(date[3]),month,day + 1,2,59,59);
    if (expires <= now) continue;
    const min = terms.match(/\b(?:pedidos|compras) acima de (R\$\s*\d+(?:,\d{2})?)(?![\d,])/i);
    const app = /exclusivo para pedidos realizados no aplicativo/i.test(terms);
    const first = /primeira compra e para clientes sem compras h[aá] mais de 12 meses/i.test(terms);
    const selected = /clientes selecionados/i.test(terms);
    coupons.push({
      store:'americanas',code,expires:new Date(expires).toISOString(),
      title:discount[1] + ' de desconto' + (app ? ' no app' : ''),
      description:[min ? 'Compras acima de ' + min[1] + '.' : '',first ? 'Para primeira compra ou clientes sem compras há mais de 12 meses.' : '',selected ? 'Para clientes selecionados.' : '', 'Confira as condições na fonte.'].filter(Boolean).join(' '),
    });
  }
  return coupons;
}

function json(payload, status = 200) {
  return Response.json(payload,{status,headers:{'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
}
const searchCache = new Map();
const searchCardCache = new WeakMap();
const couponSlugs = new Map([
  ['amazon','amazon'],['amazon-br','amazon'],['mercado-livre','meli'],['casas-bahia','casas'],
  ['americanas','americanas'],['magalu','magalu'],['magazine-luiza','magalu'],
  ['havan','havan'],['carrefour','carrefour'],['kabum','kabum'],['assai','assai'],['atacadao','atacadao'],
  ['electrolux','electrolux'],['samsung','samsung'],['shopee','shopee'],['aliexpress','aliexpress'],
]);
const additionalCouponStores = {
  electrolux:'Electrolux',samsung:'Samsung',shopee:'Shopee',aliexpress:'AliExpress',
};
function couponProviderUrl(value, prefix) {
  const candidate = safeUrl(value,'https://cupomdescontos.com');
  if (!candidate) return null;
  const url = new URL(candidate);
  return url.origin === 'https://cupomdescontos.com' && url.pathname.startsWith(prefix) ? url.href : null;
}

async function aggregatedCoupons(now) {
  const slugs = ['mercado-livre','amazon','kabum','casas-bahia','magalu','electrolux','shopee','samsung','aliexpress'];
  const batches = await Promise.allSettled(slugs.map(async store => {
    const url = 'https://cupomdescontos.com/api/coupons?' + new URLSearchParams({store,limit:'6',sort:'newest'});
    const payload = await (await upstream(url,5000)).json();
    if (!Array.isArray(payload.data)) throw new Error('Resposta de cupons inválida');
    return payload.data;
  }));
  if (batches.every(batch => batch.status === 'rejected')) throw new Error('Fonte de cupons indisponível');
  return batches.flatMap(batch => batch.status === 'fulfilled' ? batch.value : []).flatMap(item => {
    const store = couponSlugs.get(item?.store_slug);
    const code = typeof item?.code === 'string' ? item.code.trim().toUpperCase() : '';
    const expires = Date.parse(item?.expires_at);
    const url = couponProviderUrl(item?.url,'/ir/');
    const sourceUrl = couponProviderUrl(item?.source_url,'/cupom/');
    if (!store || !/^[A-Z0-9_-]{3,48}$/.test(code) || !(expires > now) || !url || !sourceUrl) return [];
    return [{
      store,storeName:additionalCouponStores[store],code,expires:new Date(expires).toISOString(),
      title:plain(item.title).slice(0,180) || 'Cupom de desconto',
      description:plain(item.conditions).slice(0,330) || 'Confira as condições publicadas pela fonte.',
      source:'CupomDescontos.com',sourceUrl,url,
    }];
  });
}

const couponCache = {value:null,until:0,pending:null};
async function collectDiscounts(now) {
  const page = stores.find(item => item.id === 'americanas');
  const [official, aggregator] = await Promise.allSettled([
    upstream(page.url,4000).then(response => response.text()).then(body => parseAmericanasCoupons(body,now)),
    aggregatedCoupons(now),
  ]);
  const direct = official.status === 'fulfilled' && official.value.length ? official.value : seedCoupons;
  const secondary = aggregator.status === 'fulfilled'
    ? aggregator.value
    : (couponCache.value?.coupons || []).filter(item => item.source === 'CupomDescontos.com');
  const merged = new Map();
  for (const item of [...direct,...secondary]) {
    const key = item.store + ':' + item.code;
    if (Date.parse(item.expires) > now && !merged.has(key)) merged.set(key,item);
  }
  couponCache.value = {coupons:[...merged.values()]};
  couponCache.until = now + (aggregator.status === 'fulfilled' ? 600_000 : 120_000);
  return couponCache.value;
}

export function getDiscounts() {
  const now = Date.now();
  if (couponCache.until > now) return {coupons:couponCache.value.coupons.filter(item => Date.parse(item.expires) > now)};
  couponCache.pending ||= collectDiscounts(now).finally(() => { couponCache.pending = null; });
  return couponCache.pending;
}

const homeCache = {value:null,until:0,pending:null};
async function collectHome() {
  const products = await Promise.all(featured.map(async product => {
    const [search, ...pages] = await Promise.allSettled([
      getOffers(product.query,{},product.model),
      ...product.pages.map(page => listedProduct(page,product)),
    ]);
    const found = search.status === 'fulfilled' ? search.value.offers : [];
    const direct = pages.flatMap(entry => entry.status === 'fulfilled' ? entry.value : []);
    const card = buildProductCard(product,[...direct,...found],normalize);
    if (!card) return null;
    const variants = await Promise.all(card.variants.slice(0,8).map(findVariantPhoto));
    return {...card,variants:[...variants,...card.variants.slice(8)]};
  }));
  homeCache.value = {products:products.filter(Boolean),checkedAt:new Date().toISOString()};
  homeCache.until = Date.now() + (homeCache.value.products.length ? 300_000 : 30_000);
  return homeCache.value;
}

function getHome() {
  if (homeCache.until > Date.now()) return homeCache.value;
  homeCache.pending ||= collectHome().finally(() => { homeCache.pending = null; });
  return homeCache.pending;
}

const applianceStores = new Set(['philco','electrolux','mondial','brastemp']);
const applianceQuery = /\b(?:eletrodomesticos?|microondas|cafeteira|ventilador|lavadora|lava e seca|geladeira|refrigerador|fogao|cooktop|forno|air fryer|airfryer|fritadeira|liquidificador|secadora|lava loucas|aspirador|philco|electrolux|mondial|brastemp)\b/;

async function getOffers(query,env,model) {
  const sourceQuery = canonicalSearchQuery(query);
  const normalized = normalizeSearch(sourceQuery);
  const key = (model ? 'featured:' : 'search:') + Number(!!env.SERPAPI_API_KEY) + Number(!!env.APISH_API_KEY) + ':' + normalized;
  const cached = searchCache.get(key);
  if (cached?.until > Date.now()) return cached.result;
  const requests = [
    ['havan',havan(sourceQuery)],
    ['americanas',vtex(sourceQuery,'https://www.americanas.com.br','Americanas')],
    ['carrefour',vtex(sourceQuery,'https://mercado.carrefour.com.br','Carrefour')],
    ['kabum',kabum(sourceQuery)],
  ];
  if (!model) {
    const casas = byName.get('casas bahia');
    const ponto = byName.get('ponto frio');
    requests.push(
      ['casas',env.APISH_API_KEY ? casasBahiaApi(sourceQuery,env.APISH_API_KEY) : structuredStoreSearch(sourceQuery,casas)],
      ['ponto',structuredStoreSearch(sourceQuery,ponto)],
      ...searchStores.filter(store => store.catalog && (!applianceStores.has(store.id) || applianceQuery.test(normalized)))
        .map(store => [store.id,vtex(sourceQuery,store.catalog,store.name,store.intelligent)]),
    );
  }
  if (env.SERPAPI_API_KEY) requests.push(['shopping',shopping(sourceQuery,env.SERPAPI_API_KEY)]);
  const responses = await Promise.allSettled(requests.map(([,request]) => request));
  const sources = Object.fromEntries(requests.map(([name],i) => [name,responses[i].status === 'fulfilled' ? 'available' : 'unavailable']));
  const words = normalized.split(' ').filter(word => word && !noMatchWords.has(word));
  const microwaveOnly = words.includes('microondas') && !microwavePart.test(normalized) && !microwaveToy.test(normalized);
  const raw = responses.flatMap(entry => entry.status === 'fulfilled' ? entry.value : []);
  const sorted = [...new Map(raw.filter(offer => {
    if (model) return model.test(normalize(offer.title));
    const title = normalizeSearch(offer.title);
    const microwaveAt = title.indexOf('microondas');
    if (microwaveOnly && microwaveAt >= 0 && (microwavePart.test(title.slice(0,microwaveAt)) || microwaveToy.test(title))) return false;
    const wordsInTitle = title.split(' ');
    return words.every(word => wordsInTitle.some(titleWord => titleWord === word || (word.length > 3 && titleWord === word + 's')));
  }).sort((a,b) => b.price - a.price).map(item => [item.store + '|' + item.url,item])).values()].sort((a,b) => a.price - b.price);
  const marketplaceOffers = new Set([...new Set(marketplaces.map(({store}) => store.id)),...searchStores.filter(store => store.catalog).map(store => store.id)]
    .flatMap(id => sorted.filter(offer => offer.storeId === id).slice(0,1)));
  const offers = sorted.filter(offer => !marketplaceOffers.has(offer)).slice(0,30 - marketplaceOffers.size)
    .concat([...marketplaceOffers]).sort((a,b) => a.price - b.price);
  const shoppingStatus = sources.shopping || 'unconfigured';
  const result = { offers, available:responses.some(entry => entry.status === 'fulfilled'), wide:shoppingStatus === 'available', shoppingStatus, sources };
  if (searchCache.size >= 200) searchCache.delete(searchCache.keys().next().value);
  searchCache.set(key,{result,until:Date.now() + (result.available ? 180_000 : 30_000)});
  return result;
}

function searchCards(result) {
  if (!searchCardCache.has(result)) {
    const products = buildSearchCards(result.offers,normalizeSearch);
    // Limit detail-page lookups to variants that have a supported photo fallback.
    const missingPhotos = products.flatMap(card => card.variants)
      .filter(variant => !variant.image && variant.offers.some(offer => offer.storeId === 'havan'))
      .slice(0,10);
    const hydrated = Promise.all(missingPhotos.map(findVariantPhoto)).then(variants => {
      const photos = new Map(missingPhotos.map((variant,index) => [variant,variants[index]]));
      return products.map(card => ({...card,variants:card.variants.map(variant => photos.get(variant) || variant)}));
    });
    searchCardCache.set(result,hydrated);
  }
  return searchCardCache.get(result);
}

export default {
  async fetch(request,env = {}) {
    if (request.method !== 'GET') return new Response(null,{status:405,headers:{Allow:'GET'}});
    const url = new URL(request.url);
    if (url.pathname === '/api/search') {
      const q = (url.searchParams.get('q') || '').trim().replace(/\s+/g,' ');
      if (q.length < 2 || q.length > 120 || !normalize(q)) return json({error:'Informe um produto de 2 a 120 caracteres.'},400);
      const result = await getOffers(q,env);
      return json({...result,products:await searchCards(result)});
    }
    if (url.pathname === '/api/home') return json(await getHome());
    if (url.pathname === '/api/discounts') return json(await getDiscounts());
    return new Response('Página não encontrada',{status:404});
  },
};
