-- === TABLE ===============================================================
CREATE TABLE IF NOT EXISTS public.asset_indicators_daily (
  asset_id uuid NOT NULL,
  date date NOT NULL,
  close numeric(20,10) NOT NULL,
  sma_50 numeric,
  sma_200 numeric,
  ema_12 numeric,
  ema_26 numeric,
  macd numeric,
  macd_signal_9 numeric,
  macd_hist numeric,
  rsi_14 numeric,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (asset_id, date)
);

-- === VIEWS & FUNCTIONS ===================================================
CREATE OR REPLACE VIEW public.v_prices AS
SELECT asset_id, date, close,
       ROW_NUMBER() OVER (PARTITION BY asset_id ORDER BY date) AS rn
FROM public.assetjet_price_history
WHERE close IS NOT NULL;

CREATE OR REPLACE FUNCTION public.fn_sma(period int)
RETURNS TABLE (asset_id uuid, date date, sma numeric)
LANGUAGE sql AS $$
  SELECT asset_id, date,
         AVG(close) OVER (
           PARTITION BY asset_id ORDER BY date
           ROWS BETWEEN (period - 1) PRECEDING AND CURRENT ROW
         ) AS sma
  FROM public.v_prices;
$$;

CREATE OR REPLACE FUNCTION public.fn_ema(period int)
RETURNS TABLE (asset_id uuid, date date, ema numeric)
LANGUAGE sql AS $$
WITH RECURSIVE
base AS (SELECT asset_id, date, close, rn FROM public.v_prices),
seed AS (
  SELECT b.asset_id, b.date, AVG(b2.close) AS seed_val, b.rn
  FROM base b
  JOIN base b2 ON b2.asset_id=b.asset_id AND b2.rn BETWEEN 1 AND period
  WHERE b.rn=period
  GROUP BY b.asset_id,b.date,b.rn
),
ema AS (
  SELECT s.asset_id, s.date, s.seed_val::numeric AS ema, s.rn FROM seed s
  UNION ALL
  SELECT b.asset_id, b.date,
         (b.close*(2.0/(period+1))+e.ema*(1-(2.0/(period+1))))::numeric,
         b.rn
  FROM ema e JOIN base b ON b.asset_id=e.asset_id AND b.rn=e.rn+1
)
SELECT asset_id, date, ema FROM ema ORDER BY asset_id, date;
$$;

CREATE OR REPLACE VIEW public.v_macd AS
WITH RECURSIVE
e12 AS (SELECT * FROM public.fn_ema(12)),
e26 AS (SELECT * FROM public.fn_ema(26)),
macd_raw AS (
  SELECT e12.asset_id, e12.date, (e12.ema - e26.ema)::numeric AS macd
  FROM e12 JOIN e26 USING (asset_id, date)
),
base AS (
  SELECT asset_id, date, macd,
         ROW_NUMBER() OVER (PARTITION BY asset_id ORDER BY date) AS rn
  FROM macd_raw
),
seed AS (
  SELECT b.asset_id, b.date, AVG(b2.macd) AS seed_val, b.rn
  FROM base b JOIN base b2 ON b2.asset_id=b.asset_id AND b2.rn BETWEEN 1 AND 9
  WHERE b.rn=9
  GROUP BY b.asset_id,b.date,b.rn
),
sig AS (
  SELECT s.asset_id, s.date, s.seed_val::numeric AS signal_9, s.rn FROM seed s
  UNION ALL
  SELECT b.asset_id, b.date,
         (b.macd*(2.0/10)+sig.signal_9*(1-(2.0/10)))::numeric, b.rn
  FROM sig JOIN base b ON b.asset_id=sig.asset_id AND b.rn=sig.rn+1
)
SELECT m.asset_id, m.date, m.macd, sig.signal_9, (m.macd - sig.signal_9)::numeric AS macd_hist
FROM macd_raw m LEFT JOIN sig USING (asset_id, date)
ORDER BY m.asset_id, m.date;

CREATE OR REPLACE VIEW public.v_rsi_14 AS
WITH RECURSIVE
deltas AS (
  SELECT asset_id, date, close,
         (close - LAG(close) OVER (PARTITION BY asset_id ORDER BY date)) AS delta,
         ROW_NUMBER() OVER (PARTITION BY asset_id ORDER BY date) AS rn
  FROM public.v_prices
),
gl AS (
  SELECT asset_id, date, rn,
         GREATEST(delta,0) AS gain,
         GREATEST(-delta,0) AS loss
  FROM deltas WHERE delta IS NOT NULL
),
seed AS (
  SELECT g.asset_id, g.date, AVG(g.gain) AS avg_gain, AVG(g.loss) AS avg_loss, g.rn
  FROM gl g JOIN gl g2 ON g2.asset_id=g.asset_id AND g2.rn BETWEEN 2 AND 15
  WHERE g.rn=15
  GROUP BY g.asset_id,g.date,g.rn
),
rsi AS (
  SELECT s.asset_id, s.date, s.avg_gain, s.avg_loss, s.rn FROM seed s
  UNION ALL
  SELECT g.asset_id, g.date,
         ((rsi.avg_gain*13.0+g.gain)/14.0),
         ((rsi.avg_loss*13.0+g.loss)/14.0),
         g.rn
  FROM rsi JOIN gl g ON g.asset_id=rsi.asset_id AND g.rn=rsi.rn+1
)
SELECT asset_id, date,
       CASE WHEN avg_loss=0 THEN 100
            ELSE ROUND(100 - (100 / (1 + (avg_gain/NULLIF(avg_loss,0)))), 6)
       END AS rsi_14
FROM rsi
ORDER BY asset_id, date;

CREATE OR REPLACE VIEW public.v_all_indicators AS
WITH
sma50  AS (SELECT asset_id, date, sma AS sma_50  FROM public.fn_sma(50)),
sma200 AS (SELECT asset_id, date, sma AS sma_200 FROM public.fn_sma(200))
SELECT p.asset_id, p.date, p.close,
       s50.sma_50, s200.sma_200,
       e12.ema AS ema_12, e26.ema AS ema_26,
       m.macd, m.signal_9 AS macd_signal_9, m.macd_hist,
       r.rsi_14
FROM public.v_prices p
LEFT JOIN sma50 s50   USING (asset_id, date)
LEFT JOIN sma200 s200 USING (asset_id, date)
LEFT JOIN public.fn_ema(12) e12 USING (asset_id, date)
LEFT JOIN public.fn_ema(26) e26 USING (asset_id, date)
LEFT JOIN public.v_macd m      USING (asset_id, date)
LEFT JOIN public.v_rsi_14 r    USING (asset_id, date)
ORDER BY p.asset_id, p.date;

-- === PROCEDURE + RPC WRAPPER ============================================
CREATE OR REPLACE PROCEDURE public.populate_daily_indicators(
  p_asset_id   uuid DEFAULT NULL,
  p_start_date date DEFAULT NULL,
  p_end_date   date DEFAULT NULL
)
LANGUAGE plpgsql AS $$
BEGIN
  DELETE FROM public.asset_indicators_daily d
  WHERE (p_asset_id IS NULL OR d.asset_id = p_asset_id)
    AND (p_start_date IS NULL OR d.date >= p_start_date)
    AND (p_end_date   IS NULL OR d.date <= p_end_date);

  INSERT INTO public.asset_indicators_daily (
    asset_id, date, close,
    sma_50, sma_200,
    ema_12, ema_26,
    macd, macd_signal_9, macd_hist,
    rsi_14
  )
  SELECT v.asset_id, v.date, v.close,
         v.sma_50, v.sma_200,
         v.ema_12, v.ema_26,
         v.macd, v.macd_signal_9, v.macd_hist,
         v.rsi_14
  FROM public.v_all_indicators v
  WHERE (p_asset_id IS NULL OR v.asset_id = p_asset_id)
    AND (p_start_date IS NULL OR v.date >= p_start_date)
    AND (p_end_date   IS NULL OR v.date <= p_end_date);
END;
$$;

CREATE OR REPLACE FUNCTION public.populate_daily_indicators_fn(
  p_asset_id   uuid DEFAULT NULL,
  p_start_date date DEFAULT NULL,
  p_end_date   date DEFAULT NULL
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER AS $$
BEGIN
  CALL public.populate_daily_indicators(p_asset_id, p_start_date, p_end_date);
END;
$$;

GRANT EXECUTE ON FUNCTION public.populate_daily_indicators_fn(uuid, date, date)
TO anon, authenticated;
