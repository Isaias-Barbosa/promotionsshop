BEGIN;

CREATE TABLE IF NOT EXISTS coupon_push_subscriptions (
  endpoint text PRIMARY KEY,
  p256dh text NOT NULL,
  auth text NOT NULL,
  last_event bigint NOT NULL,
  last_attempt_at timestamptz
);

CREATE TABLE IF NOT EXISTS coupon_push_feed (
  source text PRIMARY KEY
);

CREATE TABLE IF NOT EXISTS coupon_push_events (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  store text NOT NULL,
  code text NOT NULL,
  expires_at timestamptz NOT NULL,
  UNIQUE (store, code)
);

CREATE TABLE IF NOT EXISTS coupon_push_lock (
  id boolean PRIMARY KEY CHECK (id),
  token uuid NOT NULL,
  expires_at timestamptz NOT NULL
);

-- The first nonempty snapshot from each source becomes its baseline.
CREATE OR REPLACE FUNCTION sync_coupon_push_events(payload jsonb)
RETURNS integer
LANGUAGE plpgsql
AS $$
DECLARE
  batch record;
  first_snapshot boolean;
  inserted integer := 0;
  added integer;
BEGIN
  PERFORM pg_advisory_xact_lock(91821, 1);
  FOR batch IN
    SELECT source, jsonb_agg(to_jsonb(c)) AS coupons
    FROM jsonb_to_recordset(payload) AS c(source text, store text, code text, expires_at timestamptz)
    WHERE expires_at > now()
    GROUP BY source
    ORDER BY source
  LOOP
    INSERT INTO coupon_push_feed VALUES (batch.source) ON CONFLICT DO NOTHING;
    first_snapshot := FOUND;

    INSERT INTO coupon_push_events (store, code, expires_at)
    SELECT store, code, CASE WHEN first_snapshot THEN '-infinity'::timestamptz ELSE expires_at END
    FROM jsonb_to_recordset(batch.coupons) AS c(store text, code text, expires_at timestamptz)
    ON CONFLICT (store, code) DO NOTHING;
    GET DIAGNOSTICS added = ROW_COUNT;
    IF NOT first_snapshot THEN
      inserted := inserted + added;
    END IF;
  END LOOP;
  RETURN inserted;
END;
$$;

COMMIT;
