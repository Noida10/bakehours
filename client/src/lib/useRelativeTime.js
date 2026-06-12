import { useEffect, useState } from 'react';

// Format an ISO timestamp as "3h ago", "2 min ago", etc.
export function formatRelative(iso) {
  if (!iso) return 'not submitted';
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return 'not submitted';
  const diff = Date.now() - then;
  const sec = Math.round(diff / 1000);
  if (sec < 10) return 'just now';
  if (sec < 60) return `${sec}s ago`;
  const min = Math.round(sec / 60);
  if (min < 60) return `${min} min ago`;
  const hr = Math.round(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const days = Math.round(hr / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(iso).toLocaleDateString();
}

// Re-render every `interval` ms so relative timestamps stay fresh.
export function useNow(interval = 30000) {
  const [, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), interval);
    return () => clearInterval(id);
  }, [interval]);
}
