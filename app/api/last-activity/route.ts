// app/api/last-activity/route.ts
import { fetchLastActivity } from '../../lib/fetchLastActivity';

export async function GET() {   // ✅ async here
  const data = await fetchLastActivity(['XRP/USD', 'BTC/USD', 'ETH/USD']);
  return new Response(JSON.stringify(data), {
    headers: { 'content-type': 'application/json' }
  });
}