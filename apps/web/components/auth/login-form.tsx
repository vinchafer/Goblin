"use client";

import { useState } from "react";
import { ArrowRight, CheckCircle, Loader2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

export function LoginForm() {
  const [email, setEmail] = useState("");
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
        options: { emailRedirectTo: `${window.location.origin}/auth/callback` }
      });
      if (error) throw error;
      setSent(true);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  if (sent) {
    return (
      <div
        className="rounded-2xl border p-8 text-center"
        style={{ borderColor: "var(--goblin-border)", backgroundColor: "#fff" }}
      >
        <CheckCircle
          className="w-14 h-14 mx-auto mb-4"
          style={{ color: "var(--goblin-moss)" }}
        />
        <h3
          className="font-fraunces font-bold text-xl mb-2"
          style={{ color: "var(--goblin-bark)" }}
        >
          Check your inbox
        </h3>
        <p
          className="text-sm mb-5"
          style={{ color: "var(--goblin-meta)", fontFamily: "var(--font-dm-sans)" }}
        >
          Link sent to{" "}
          <span style={{ color: "var(--goblin-moss)", fontWeight: 500 }}>{email}</span>
        </p>
        <button
          type="button"
          onClick={() => { setSent(false); setEmail(""); }}
          className="text-sm"
          style={{ color: "var(--goblin-ochre)", fontFamily: "var(--font-dm-sans)" }}
        >
          Use a different email
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <input
          id="email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          placeholder="you@example.com"
          className="w-full px-4 rounded-xl border focus:outline-none focus:ring-2 focus:ring-offset-1"
          style={{
            height: "48px",
            borderColor: "var(--goblin-border)",
            backgroundColor: "#fff",
            color: "var(--goblin-bark)",
            fontFamily: "var(--font-dm-sans)",
            fontSize: "16px",
            "--tw-ring-color": "var(--goblin-moss)"
          } as React.CSSProperties}
        />
      </div>

      {error && (
        <div
          className="p-3 rounded-lg text-sm"
          style={{
            backgroundColor: "#FEF2F2",
            color: "#991B1B",
            fontFamily: "var(--font-dm-sans)"
          }}
        >
          {error}
        </div>
      )}

      <button
        type="submit"
        disabled={loading || !email}
        className="w-full flex items-center justify-center gap-2 rounded-xl font-medium text-white transition-colors disabled:opacity-50"
        style={{
          height: "48px",
          backgroundColor: "var(--goblin-moss)",
          fontFamily: "var(--font-dm-sans)"
        }}
        onMouseEnter={(e) => {
          if (!loading && email) {
            (e.currentTarget as HTMLButtonElement).style.backgroundColor = "var(--goblin-moss2)";
          }
        }}
        onMouseLeave={(e) => {
          (e.currentTarget as HTMLButtonElement).style.backgroundColor = "var(--goblin-moss)";
        }}
      >
        {loading ? (
          <>
            <Loader2 className="w-5 h-5 animate-spin" />
            Sending magic link...
          </>
        ) : (
          <>
            Send magic link →
            <ArrowRight className="w-4 h-4" />
          </>
        )}
      </button>
    </form>
  );
}
