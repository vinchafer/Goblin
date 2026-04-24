"use client";

import Link from "next/link";
import { useEffect } from "react";

export default function Error({
  error,
  reset
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 text-center">
      <h1 className="text-6xl font-bold mb-4" style={{ fontFamily: 'Fraunces, Georgia, serif', color: 'var(--goblin-moss)' }}>
        Whoops
      </h1>
      <p className="text-lg mb-6 max-w-md" style={{ color: 'var(--goblin-gray)' }}>
        Your goblin got confused. Refresh and try again.
      </p>

      <div className="flex gap-4">
        <button
          onClick={() => reset()}
          className="px-6 py-2.5 rounded-lg font-medium"
          style={{ backgroundColor: 'var(--goblin-moss)', color: 'white' }}
        >
          Try again
        </button>

        <Link
          href="/"
          className="px-6 py-2.5 rounded-lg font-medium border"
          style={{ borderColor: 'var(--goblin-moss)', color: 'var(--goblin-moss)' }}
        >
          Go home
        </Link>
      </div>
    </div>
  );
}