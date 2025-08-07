import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

interface Asset {
  id: string;
  symbol: string;
}

// Maps asset symbols → CoinGecko IDs
const assetMap: Record<string, string> = {
  BTC: 'bitcoin',
  ETH: 'ethereum',
  SOL: 'solana',
  XRP: 'ripple',
  DOGE: 'dogecoin',
  SHIB: 'shiba-inu'
  // Add more if needed
};

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST() {
  // 1. Fetch supported assets from Supabase
  const { data: assets, error } = await supabase
    .from('assetjet_assets')
    .select('id, symbol');

  if (error || !assets || assets.length === 0) {
    return NextResponse.json(
      { error: error?.message || 'No assets found' },
      { status: 500 }
    );
  }

  // 2. Map asset symbols → CoinGecko IDs
  const assetIds = assets
    .map(asset => assetMap[asset.symbol])
    .filter(Boolean); // remove undefined

  if (assetIds.length === 0) {
    return NextResponse.json(
      { error: 'No matching CoinGecko asset IDs found' },
      { status: 400 }
    );
  }

  // 3. Build dynamic URL
  const idsQuery = assetIds.join(',');
  const url = `https://api.coingecko.com/api/v3/simple/price?ids=${idsQuery}&vs_currencies=usd`;

  const response = await fetch(url);
  const prices = await response.json();
  const today = new Date().toISOString().split('T')[0];

  // 4. Insert prices for each asset
  for (const asset of assets) {
    const coingeckoId = assetMap[asset.symbol];
    const price = prices[coingeckoId]?.usd;

    if (!price) {
      console.warn(`⚠️ Skipping ${asset.symbol}: no price from CoinGecko`);
      continue;
    }

    const { error: insertError } = await supabase
      .from('assetjet_price_history')
      .upsert(
        {
          asset_id: asset.id,
          date: today,
          open: price,
          high: price,
          low: price,
          close: price,
          volume: null
        },
        { onConflict: 'asset_id,date' }
      );

    if (insertError) {
      console.error(`❌ Insert failed for ${asset.symbol}:`, insertError.message);
    }
  }

  // 5. Recalculate indicators
  const { error: rpcError } = await supabase.rpc('populate_daily_indicators');
  if (rpcError) {
    return NextResponse.json({ error: 'Indicator calculation failed' }, { status: 500 });
  }

  return NextResponse.json({
    message: '✅ Prices updated dynamically and indicators populated!',
    assetsProcessed: assetIds.length
  });
}
