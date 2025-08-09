'use client';
import { useEffect, useState } from 'react';
import { Table } from 'antd';

type LastActivity = {
  symbol: string;
  price: number;
  action?: string | null;
  signals?: string[] | null;
  ts?: string | null; // ← treat as single ISO string
};

const COIN_IMAGE: Record<string, string> = {
  'BTC/USD': 'bitcoin',
  'ETH/USD': 'ethereum', // ← fixed spelling
  'XRP/USD': 'xrp',
  'ADA/USD': 'ada',
  'DOGE/USD': 'doge',
  'SOL/USD': 'sol',
  'USDC/USD': 'usdc',
  'SHIB/USD': 'shib',
};

export default function Home() {
  const [data, setData] = useState<LastActivity[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const columns = [
    {
      title: 'Coin',
      dataIndex: 'symbol',
      key: 'coin',
      render: (val: string) => {
        const name = COIN_IMAGE[val];
        return name ? <img src={`/${name}.png`} alt={name} width={32} height={32} /> : null;
      },
    },
    {
      title: 'Symbol',
      dataIndex: 'symbol',
      key: 'symbol-col',
    },
    {
      title: 'Price',
      dataIndex: 'price',
      key: 'price',
    },
    {
      title: 'Action',
      dataIndex: 'action',
      key: 'action',
      render: (val?: string | null) => <div>{val?.toUpperCase() || ''}</div>,
    },
    {
      title: 'Signals',
      dataIndex: 'signals',
      key: 'signals',
      render: (val?: string[] | null) => <div>{Array.isArray(val) ? val.join(', ') : ''}</div>,
    },
    {
      title: 'Last Update',
      dataIndex: 'ts',
      key: 'ts',
      render: (val?: string | null) => {
        if (!val) return null;
        const localTime = new Date(val).toLocaleString();
        return <div>{localTime}</div>;
      },
    },
  ];

  useEffect(() => {
    const ac = new AbortController();
    const symbols = ['ADA/USD', 'BTC/USD', 'DOGE/USD', 'ETH/USD', 'SHIB/USD', 'SOL/USD', 'USDC/USD', 'XRP/USD'];
    const qs = new URLSearchParams({ symbols: symbols.join(',') }).toString();

    (async () => {
      try {
        setLoading(true);
        const res = await fetch(`/api/last-activity?${qs}`, {
          signal: ac.signal,
          cache: 'no-store',
        });
        if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
        const json = await res.json();
        // If your API returns { data: [...] }, switch to: const arr = json.data ?? [];
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
    <main className="p-4 h-[100vh] flex justify-center items-center">
      <div className="w-[90%]">
        <Table
          rowKey="symbol"            // ← important
          dataSource={data}
          columns={columns as any}   // or type ColumnsType<LastActivity>
          pagination={false}
        />
      </div>
    </main>
  );
}
