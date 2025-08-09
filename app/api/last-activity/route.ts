// app/api/last-activity/route.ts
import { fetchLastActivity } from '../../lib/fetchLastActivity';

export async function GET() {
  const data = await fetchLastActivity(['XRP/USD', 'BTC/USD', 'ETH/USD', 'SOL/USD', 'ADA/USD', 'DOGE/USD', 'SHIB/USD', 'USDC/USD']);
  return new Response(JSON.stringify(data), {
    headers: {
      'content-type': 'application/json',
      'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
      'Netlify-CDN-Cache-Control': 'no-store',   // Netlify edge
      'CDN-Cache-Control': 'no-store',           // other CDNs, just in case
    }
  });
}