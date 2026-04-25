"use client";

import { useEffect } from "react";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('[APP ERROR]', error.message, error.digest);
  }, [error]);

  return (
    <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: 'var(--goblin-cream)' }}>
      <div className="max-w-md text-center p-6 space-y-4">
        <div className="text-6xl mb-4">🤕</div>
        <h2 className="text-2xl font-semibold" style={{ color: 'var(--goblin-bark)' }}>
          Something went wrong
        </h2>
        <p style={{ color: 'var(--goblin-warn)' }}>
          Your goblin got confused. Try refreshing.
        </p>
        <button
          onClick={() => reset()}
          className="px-6 py-2.5 rounded-lg font-medium text-white"
          style={{ backgroundColor: 'var(--goblin-moss)' }}
        >
          Refresh
        </button>
      </div>
    </div>
  );
}