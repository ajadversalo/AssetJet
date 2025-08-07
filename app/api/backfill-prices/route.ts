import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

type OHLCRow = [number, number, number, number, number]; // [ts, open, high, low, close]
type Asset = { id: string; symbol: string };

// Map your symbols → CoinGecko IDs (quick start).
// (Even better: add a `coingecko_id` column in assetjet_assets and read it from DB.)
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
  process.env.SUPABASE_SERVICE_ROLE_KEY! // server only
);

// Helper: YYYY-MM-DD in UTC
const toUTCDate = (ms: number) => new Date(ms).toISOString().slice(0, 10);

export async function POST() {
  try {
    // 1) Get assets you care about
    const { data: assets, error } = await supabase
      .from('assetjet_assets')
      .select('id, symbol');

    if (error || !assets?.length) {
      return NextResponse.json(
        { error: error?.message || 'No assets found' },
        { status: 500 }
      );
    }

    // Filter to ones we know how to fetch
    const fetchList = (assets as Asset[]).filter(a => assetMap[a.symbol]);
    if (!fetchList.length) {
      return NextResponse.json({ message: 'No mapped assets to fetch.' });
    }

    const results: Record<string, number> = {}; // per-symbol inserted/updated count

    // 2) For each asset, fetch 14-day OHLC and upsert one row per day
    for (const asset of fetchList) {
      const id = assetMap[asset.symbol]; // CoinGecko id
      const url = `https://api.coingecko.com/api/v3/coins/${id}/ohlc?vs_currency=usd&days=14`;

      const resp = await fetch(url, { cache: 'no-store' });
      if (!resp.ok) {
        console.warn(`⚠️ ${asset.symbol} fetch failed: ${resp.status} ${resp.statusText}`);
        continue;
      }

      const ohlc: OHLCRow[] = await resp.json();

      // CoinGecko returns multiple rows (often 15 entries, one per day).
      // We upsert each by date. Use open/high/low/close; set volume null.
      let count = 0;
      for (const [ts, open, high, low, close] of ohlc) {
        const date = toUTCDate(ts);
        const { error: upErr } = await supabase
          .from('assetjet_price_history')
          .upsert(
            {
              asset_id: asset.id,
              date,
              open,
              high,
              low,
              close,
              volume: null,
            },
            { onConflict: 'asset_id,date' }
          );
        if (!upErr) count += 1;
        else console.error(`❌ Upsert failed ${asset.symbol} ${date}:`, upErr.message);
      }

      results[asset.symbol] = count;
    }

    // 3) (Optional) Recompute indicators after backfill
    const { error: rpcError } = await supabase.rpc('populate_daily_indicators');
    if (rpcError) {
      // Not fatal—price history is still backfilled
      console.warn('Indicator calculation failed:', rpcError.message);
    }

    return NextResponse.json({
      message: '✅ Backfilled up to 14 days of OHLC per asset (missing days included).',
      results,
      indicators: rpcError ? 'failed' : 'ok',
    });
  } catch (err: any) {
    console.error('Backfill error:', err);
    return NextResponse.json({ error: err.message || 'Unknown error' }, { status: 500 });
  }
}
