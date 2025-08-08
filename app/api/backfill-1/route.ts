// app/api/backfill/route.ts
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

type Asset = { id: string; symbol: string };
type PricePoint = [number, number]; // [ms, close]

// Quick map (swap to a DB column later if you like)
const assetMap: Record<string, string> = {
  BTC: 'bitcoin',
  ETH: 'ethereum',
  SOL: 'solana',
  XRP: 'ripple',
  DOGE: 'dogecoin',
  SHIB: 'shiba-inu',
};

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const toUTCDate = (ms: number) => new Date(ms).toISOString().slice(0, 10);

async function run(req: Request) {
  const url = new URL(req.url);
  const symbol = url.searchParams.get('symbol')?.toUpperCase() || null;
  const assetIdParam = url.searchParams.get('asset_id');
  const days = Math.max(1, Number(url.searchParams.get('days') || 90));

  if (!symbol && !assetIdParam) {
    return NextResponse.json(
      { error: 'Provide ?symbol=BTC (or) ?asset_id=<uuid>' },
      { status: 400 }
    );
  }

  // 1) Resolve the asset
  const { data: assets, error: assetsErr } = await supabase
    .from('assetjet_assets')
    .select('id, symbol');

  if (assetsErr) return NextResponse.json({ error: assetsErr.message }, { status: 500 });

  let asset: Asset | undefined;
  if (assetIdParam) asset = assets?.find(a => a.id === assetIdParam);
  if (!asset && symbol) asset = assets?.find(a => a.symbol === symbol);

  if (!asset) {
    return NextResponse.json({ error: 'Asset not found in DB' }, { status: 404 });
  }

  const cgId = assetMap[asset.symbol];
  if (!cgId) {
    return NextResponse.json({ error: `No CoinGecko mapping for ${asset.symbol}` }, { status: 400 });
  }

  // 2) Fetch daily closes from CoinGecko (market_chart returns daily for <=90)
  const resp = await fetch(
    `https://api.coingecko.com/api/v3/coins/${cgId}/market_chart?vs_currency=usd&days=${days}`,
    { cache: 'no-store' }
  );
  if (!resp.ok) {
    return NextResponse.json({ error: `CoinGecko HTTP ${resp.status}` }, { status: 502 });
  }

  const json = await resp.json() as { prices?: PricePoint[] };
  const prices = json.prices ?? [];

  // Dedup by date; keep last point of each day
  const byDate = new Map<string, number>();
  for (const [ms, close] of prices) byDate.set(toUTCDate(ms), close);

  // Build upserts (we only have close; set O/H/L = close)
  const rows = Array.from(byDate.entries()).sort(([a], [b]) => a.localeCompare(b)).map(([date, close]) => ({
    asset_id: asset!.id,
    date,
    open: close,
    high: close,
    low: close,
    close,
    volume: null as number | null,
  }));

  // 3) Upsert
  const { error: upErr } = await supabase
    .from('assetjet_price_history')
    .upsert(rows, { onConflict: 'asset_id,date' });

  if (upErr) {
    return NextResponse.json({ error: `Upsert failed: ${upErr.message}` }, { status: 500 });
  }

  // 4) Recompute indicators ONLY for this asset & window
  const startStr = rows[0]?.date ?? new Date(Date.now() - days * 864e5).toISOString().slice(0, 10);
  const endStr = rows.at(-1)?.date ?? new Date().toISOString().slice(0, 10);

  const { error: rpcError } = await supabase.rpc('populate_daily_indicators_fn', {
    p_asset_id: asset.id,
    p_start_date: startStr,
    p_end_date: endStr,
  });

  if (rpcError) {
    return NextResponse.json(
      { ok: true, message: 'Backfill ok; indicator calc failed', asset: asset.symbol, days: rows.length, start: startStr, end: endStr, rpcError },
      { status: 207 }
    );
  }

  return NextResponse.json({
    ok: true,
    message: `✅ Backfilled ${rows.length} days for ${asset.symbol} and recalculated indicators`,
    asset: asset.symbol,
    start: startStr,
    end: endStr,
  });
}

export async function GET(req: Request) { return run(req); }
export async function POST(req: Request) { return run(req); }
