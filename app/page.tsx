'use client';
import { useEffect, useState } from 'react';
import { Table } from "antd";

type LastActivity = {
  symbol: string;
  price: number;
  action?: string | null;
  signals?: string[] | null;
  ts?: string[] | null;
};

export default function Home() {
  const [data, setData] = useState<LastActivity[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  console.log("data ", data);

  const columns = [
    {
      title: 'Symbol',
      dataIndex: 'symbol',
      key: 'symbol',
      render: (val) => {
        console.log("val", val)
        let name = "";
        switch (val) {
          case "BTC/USD":
            name = "bitcoin";
            break;
          case "ETH/USD":
            name = "etherium";
            break;
          case "XRP/USD":
            name = "xrp";
            break;
          case "ADA/USD":
            name = "ada";
            break;
          case "DOGE/USD":
            name = "doge";
            break;
          case "SOL/USD":
            name = "sol";
            break;
          case "USDC/USD":
            name = "usdc";
            break;
          default:
            break;
        }
        return (
          <div>
            {name &&
              <img src={`/${name}.png`} alt={name} width={32} height={32} />
            }
          </div>
        )
      }
    },
    {
      title: 'Symbol',
      dataIndex: 'symbol',
      key: 'symbol',
    },
    {
      title: 'Price',
      dataIndex: 'price',
      key: 'price'
    },
    {
      title: 'Action',
      dataIndex: 'action',
      key: 'action',
      render: (val) => (
        <div>
          {val?.toUpperCase()}
        </div>
      )
    },
    {
      title: 'Signals',
      dataIndex: 'signals',
      key: 'signals',
      render: (val, record) => (
        <div>
          {val?.[0]}
        </div>
      )
    },
    {
      title: 'Last Update',
      dataIndex: 'ts',
      key: 'ts',
      render: (val: any) => {
        const utcString = val;
        const localTime = new Date(utcString).toLocaleString();
        return (
          <div>
            {localTime}
          </div>
        )
      }
    },
  ];

  useEffect(() => {
    const ac = new AbortController();
    const symbols = ['XRP/USD', 'BTC/USD', 'ETH/USD', 'SOL/USD'];
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
    <main className="p-4 h-[100vh] flex justify-center items-center">
      <div className="w-[90%]">
        <Table
          dataSource={data}
          columns={columns}
          pagination={false}
        />
      </div>
    </main>
  );
}
