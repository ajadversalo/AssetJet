// app/api/last-activity/route.ts
import { fetchLastActivity } from '../../lib/fetchLastActivity';

export async function GET() {
  const data = await fetchLastActivity(['XRP/USD', 'BTC/USD', 'ETH/USD', 'SOL/USD', 'ADA/USD', 'DOGE/USD', 'SHIB/USD', 'USDC/USD']);
  return new Response(JSON.stringify(data), {
    headers: { 'content-type': 'application/json' }
  });
}