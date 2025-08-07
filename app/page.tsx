'use client';
import { useState } from 'react';

export default function Home() {
  const [status, setStatus] = useState('');

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

      <p className="mt-4 text-sm">{status}</p>
    </main>
  );
}
