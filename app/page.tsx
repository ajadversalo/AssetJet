'use client';
import { useState, useEffect } from 'react';

export default function Home() {
  const [data, setData] = useState([]);
 
  useEffect(() => {
    fetch('/api/last-activity?symbols=XRP/USD,BTC/USD,ETH/USD')
      .then(res => res.json())
      .then(setData)
      .catch(console.error);
  }, []);

  console.log("data: ", data);

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 p-24">
      {data?.map((x, index) => {
        return (
          <div key={index}>
            <div>{x?.symbol}</div>
            <div>{x?.price}</div>
            <div>{x?.action}</div>
            <div>
              {x?.signals?.map((s, i) => {
                return(<div key={i}>{s}</div>)
              })}
            </div>
          </div>
        )
      })}
    </main>
  );
}
