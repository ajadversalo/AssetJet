'use client';
import { useEffect, useState } from 'react';

type LastActivity = {
  symbol: string;
  price: number;
  action?: string | null;
  signals?: string[] | null;
};

export default function Home() {
  const [data, setData] = useState<LastActivity[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  console.log("data ", data);

  useEffect(() => {
    const ac = new AbortController();
    const symbols = ['XRP/USD', 'BTC/USD', 'ETH/USD'];
    const qs = new URLSearchParams({ symbols: symbols.join(',') }).toString();

    (async () => {
      try {
        setLoading(true);
        const res = await fetch(`/api/last-activity?${qs}`, {
          signal: ac.signal,
          cache: 'no-store',
        });
        if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);

        const json: unknown = await res.json();
        // If your API returns { data: [...] }, change the next line accordingly:
        const arr = Array.isArray(json) ? json : [];
        setData(arr as LastActivity[]);
      } catch (e: any) {
        if (e.name !== 'AbortError') setError(e.message ?? 'Failed to load');
      } finally {
        setLoading(false);
      }
    })();

    return () => ac.abort();
  }, []);

  if (loading) return <main className="p-6">Loading…</main>;
  if (error) return <main className="p-6 text-red-600">Error: {error}</main>;

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 p-24">
      {data.map((x) => (
        <div key={x.symbol} className="rounded-xl border p-4 w-full max-w-md">
          <div className="font-semibold">{x.symbol}</div>
          <div>{x.price?.toLocaleString?.() ?? '—'}</div>
          <div>{x.action ?? '—'}</div>
          <div className="pl-4">
            {(x.signals ?? []).map((s, i) => (
              <div key={`${x.symbol}-${i}`}>{s}</div>
            ))}
          </div>
        </div>
      ))}
    </main>
  );
}
