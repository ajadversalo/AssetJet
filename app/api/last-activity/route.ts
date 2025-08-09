// app/api/last-activity/route.ts
import { NextResponse } from 'next/server';
import { fetchLastActivity } from '../../lib/fetchLastActivity';

// Make this route fully dynamic and never cached by Next
export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const fetchCache = 'force-no-store';
// Ensure Node runtime on Netlify (not Edge)
export const runtime = 'nodejs';

export async function GET(_req: Request) {
  const now = new Date().toISOString();

  try {
    const data = await fetchLastActivity([
      'XRP/USD', 'BTC/USD', 'ETH/USD', 'SOL/USD', 'ADA/USD', 'DOGE/USD', 'SHIB/USD', 'USDC/USD'
    ]);

    return new NextResponse(JSON.stringify(data), {
      status: 200,
      headers: {
        'content-type': 'application/json; charset=utf-8',
        'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
        'Netlify-CDN-Cache-Control': 'no-store',
        'CDN-Cache-Control': 'no-store',
        'Pragma': 'no-cache',
        'Expires': '0',
        'Vary': 'Authorization',
        'x-debug-now': now,
      },
    });
  } catch (err: any) {
    console.error('[/api/last-activity] error:', err);
    return NextResponse.json(
      { error: err?.message ?? 'Internal Server Error' },
      {
        status: 500,
        headers: {
          'Cache-Control': 'no-store',
          'Netlify-CDN-Cache-Control': 'no-store',
          'CDN-Cache-Control': 'no-store',
          'x-debug-now': now,
        },
      }
    );
  }
}
