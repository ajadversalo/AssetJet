// app/api/populate-indicators/route.ts
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

type Asset = { id: string; symbol: string };

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
  // MUST be the service-role key (server-side only)
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function handler() {
  try {
    // 1) Get assets we actually support
    const { data: assets, error: assetsErr } = await supabase
      .from('assetjet_assets')
      .select('id, symbol');

    if (assetsErr) throw new Error(`Fetch assets failed: ${assetsErr.message}`);
    if (!assets || assets.length === 0) {
      return NextResponse.json({ error: 'No assets found' }, { status: 400 });
    }

    const supported: Asset[] = assets.filter(a => assetMap[a.symbol]);
    if (supported.length === 0) {
      return NextResponse.json(
        { error: 'No supported symbols mapped to CoinGecko IDs' },
        { status: 400 }
      );
    }

    // 2) Pull prices from CoinGecko
    const ids = supported.map(a => assetMap[a.symbol]).join(',');
    const url = `https://api.coingecko.com/api/v3/simple/price?ids=${ids}&vs_currencies=usd`;

    const res = await fetch(url, { cache: 'no-store' });
    if (!res.ok) throw new Error(`CoinGecko HTTP ${res.status}`);
    const prices = await res.json() as Record<string, { usd: number }>;

    // 3) Upsert today's prices
    const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD (UTC)
    for (const a of supported) {
      const cgId = assetMap[a.symbol];
      const price = prices[cgId]?.usd;

      if (!price || Number.isNaN(price)) {
        console.warn(`⚠️ Skipping ${a.symbol}: no USD price from CoinGecko`);
        continue;
      }

      const { error: upsertErr } = await supabase
        .from('assetjet_price_history')
        .upsert(
          {
            asset_id: a.id,
            date: today,
            open: price,
            high: price,
            low: price,
            close: price,
            volume: null,
          },
          { onConflict: 'asset_id,date' }
        );

      if (upsertErr) {
        console.error(`❌ Upsert failed for ${a.symbol}:`, upsertErr.message);
      }
    }

    // 4) Recompute indicators (call the FUNCTION wrapper, not the procedure)
    const { error: rpcError } = await supabase.rpc('populate_daily_indicators_fn', {
      p_asset_id: null,
      p_start_date: null,
      p_end_date: null,
    });

    if (rpcError) {
      console.error('RPC error details:', rpcError);
      return NextResponse.json({ error: 'Indicator calculation failed' }, { status: 500 });
    }

    return NextResponse.json({
      ok: true,
      message: '✅ Prices updated and indicators populated',
      processed: supported.map(a => a.symbol),
      date: today,
    });
  } catch (e: any) {
    console.error('populate-indicators failed:', e?.message || e);
    return NextResponse.json({ error: String(e?.message || e) }, { status: 500 });
  }
}

// Support both GET (easy manual test in browser) and POST (from your UI button)
export async function GET() { return handler(); }
export async function POST() { return handler(); }
