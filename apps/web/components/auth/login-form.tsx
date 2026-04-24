"use client";

import { useState } from 'react';
import { Mail, ArrowRight, CheckCircle, Loader2 } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';

export function LoginForm() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const supabase = createClient();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: {
          emailRedirectTo: `${window.location.origin}/auth/callback`
        }
      });

      if (error) throw error;
      setSent(true);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  if (sent) {
    return (
      <div className="bg-white rounded-2xl border p-8 w-full max-w-md shadow-sm" style={{ borderColor: 'var(--goblin-light)' }}>
        <div className="text-center">
          <CheckCircle className="w-16 h-16 mx-auto mb-4" style={{ color: 'var(--goblin-moss)' }} />
          <h3 className="text-xl font-semibold mb-2" style={{ color: 'var(--goblin-bark)' }}>
            Check your email
          </h3>
          <p className="mb-6" style={{ color: 'var(--goblin-gray)' }}>
            We sent a magic link to <span className="font-medium" style={{ color: 'var(--goblin-moss)' }}>{email}</span>
          </p>
          <button
            type="button"
            onClick={() => {
              setSent(false);
              setEmail('');
            }}
            className="text-sm"
            style={{ color: 'var(--goblin-ochre)' }}
          >
            Use a different email
          </button>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="bg-white rounded-2xl border p-8 w-full max-w-md shadow-sm" style={{ borderColor: 'var(--goblin-light)' }}>
      <div className="mb-6">
        <label htmlFor="email" className="block text-sm font-medium mb-2" style={{ color: 'var(--goblin-slate)' }}>
          Email address
        </label>
        <div className="relative">
          <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5" style={{ color: 'var(--goblin-gray)' }} />
          <input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            placeholder="you@example.com"
            className="w-full pl-10 pr-4 py-3 rounded-lg border focus:outline-none focus:ring-2"
            style={{
              borderColor: 'var(--goblin-light)',
              backgroundColor: 'white',
              color: 'var(--goblin-slate)'
            }}
          />
        </div>
      </div>

      {error && (
        <div className="mb-4 p-3 rounded-lg text-sm" style={{ backgroundColor: '#FEF2F2', color: '#991B1B' }}>
          {error}
        </div>
      )}

      <button
        type="submit"
        disabled={loading || !email}
        className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-lg font-medium text-white transition-opacity disabled:opacity-50"
        style={{ backgroundColor: 'var(--goblin-moss)' }}
      >
        {loading ? (
          <>
            <Loader2 className="w-5 h-5 animate-spin" />
            Your goblin is sending a magic link...
          </>
        ) : (
          <>
            Send Magic Link
            <ArrowRight className="w-5 h-5" />
          </>
        )}
      </button>
    </form>
  );
}