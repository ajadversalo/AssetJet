'use client';
import { useState, useEffect } from 'react';
import { fetchLastActivity } from '../app/lib/fetchLastActivity';

export default function Home() {
  const [status, setStatus] = useState('');
  const [data, setData] = useState([]);

  async function handleFetchDaily() {
    setStatus('Fetching latest prices...');

    try {
      const res = await fetch('/api/fetch-daily-prices', { method: 'POST' });

      if (!res.ok) {
        let errorMessage = 'Unknown error';
        try {
          const err = await res.json();
          errorMessage = err?.error || res.statusText;
        } catch (jsonError) {
          console.error('Failed to parse error JSON:', jsonError);
        }
        setStatus(`❌ Failed: ${errorMessage}`);
        return;
      }

      setStatus('✅ Updated latest prices!');
    } catch (error) {
      console.error('❌ Fetch failed:', error);
      setStatus('❌ Failed: ' + (error as Error).message);
    }
  }

  async function handleBackfill() {
    setStatus('Backfilling last 14 days...');

    try {
      const res = await fetch('/api/backfill-prices', { method: 'POST' });
      const data = await res.json();

      if (!res.ok) {
        setStatus(`❌ Failed: ${data.error || res.statusText}`);
        return;
      }

      const counts = Object.entries(data.results || {})
        .map(([sym, count]) => `${sym}: ${count} days`)
        .join(', ');

      setStatus(`✅ Backfill complete! ${counts}`);
    } catch (error) {
      console.error('❌ Backfill failed:', error);
      setStatus('❌ Failed: ' + (error as Error).message);
    }
  }

  async function handleBackfill60() {
    setStatus('Backfilling last 60 days...');

    try {
      const res = await fetch('/api/backfill-60d', { method: 'POST' });

      let data: any = {};
      try {
        data = await res.json();
      } catch {
        throw new Error('Server returned no valid JSON');
      }

      if (!res.ok) {
        setStatus(`❌ Failed: ${data.error || res.statusText}`);
        return;
      }

      const results = data.results || {};
      const counts = Object.entries(results)
        .map(([sym, count]) => `${sym}: ${count} days`)
        .join(', ');

      setStatus(`✅ Backfill complete! ${counts}`);
    } catch (error) {
      console.error('❌ Backfill failed:', error);
      setStatus(`❌ Failed: ${(error as Error).message}`);
    }
  }

  async function handleBackfill1() {
    setStatus('Backfilling last 60 days...');

    try {
      const res = await fetch('/api/backfill-1?symbol=SHIB&days=90', { method: 'POST' });
      const data = await res.json();

      if (!res.ok) {
        setStatus(`❌ Failed: ${data.error || res.statusText}`);
        return;
      }

      const counts = Object.entries(data.results || {})
        .map(([sym, count]) => `${sym}: ${count} days`)
        .join(', ');

      setStatus(`✅ Backfill complete! ${counts}`);
    } catch (error) {
      console.error('❌ Backfill failed:', error);
      setStatus('❌ Failed: ' + (error as Error).message);
    }
  }

  useEffect(() => {
    fetch('/api/last-activity?symbols=XRP/USD,BTC/USD,ETH/USD')
      .then(res => res.json())
      .then(setData)
      .catch(console.error);
  }, []);

  console.log("data: ", data);

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 p-24">
      <button
        onClick={handleFetchDaily}
        className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
      >
        📥 Fetch Daily Prices
      </button>

      <button
        onClick={handleBackfill}
        className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700"
      >
        ⏪ Backfill Last 14 Days
      </button>

      <button
        onClick={handleBackfill60}
        className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700"
      >
        ⏪ Backfill Last 60 Days
      </button>

      <button
        onClick={handleBackfill1}
        className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700"
      >
        ⏪ Backfill 1
      </button>

      <p className="mt-4 text-sm">{status}</p>
    </main>
  );
}
