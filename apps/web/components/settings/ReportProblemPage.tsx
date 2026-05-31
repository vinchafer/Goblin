'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';

type Category = 'bug' | 'feature' | 'billing' | 'other';

const CATEGORIES: { id: Category; label: string }[] = [
  { id: 'bug', label: 'Bug' },
  { id: 'feature', label: 'Feature-Wunsch' },
  { id: 'billing', label: 'Abrechnung' },
  { id: 'other', label: 'Sonstiges' },
];

export function ReportProblemPage() {
  const [category, setCategory] = useState<Category>('bug');
  const [description, setDescription] = useState('');
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);

  async function submit() {
    if (description.trim().length < 5) return;
    setSending(true);
    try {
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();
      const apiBase = process.env.NEXT_PUBLIC_API_URL ?? '';
      const r = await fetch(`${apiBase}/api/support/tickets`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(session ? { Authorization: `Bearer ${session.access_token}` } : {}),
        },
        body: JSON.stringify({ category, description }),
      });
      if (r.ok) {
        setSent(true);
        setDescription('');
      }
    } finally {
      setSending(false);
    }
  }

  if (sent) {
    return (
      <div style={{ padding: 40, textAlign: 'center', fontFamily: 'var(--font-sans)' }}>
        <div style={{ fontSize: 48, marginBottom: 12 }}>✓</div>
        <h3 style={{ fontSize: 18, color: 'var(--text)', marginBottom: 6 }}>Danke!</h3>
        <p style={{ fontSize: 'var(--t-small-fs)', color: 'var(--text-meta)' }}>Wir melden uns innerhalb von 24h.</p>
      </div>
    );
  }

  return (
    <div className="settings-section" style={{ padding: '0 16px 24px', fontFamily: 'var(--font-sans)' }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div>
          <div style={{ fontSize: 'var(--t-caption-fs)', color: 'var(--text-meta)', textTransform: 'uppercase', letterSpacing: 1, fontWeight: 600, marginBottom: 8 }}>Kategorie</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {CATEGORIES.map((c) => (
              <button key={c.id} onClick={() => setCategory(c.id)} style={{
                padding: '8px 14px', borderRadius: 999,
                background: category === c.id ? 'var(--brand-green)' : 'transparent',
                color: category === c.id ? '#fff' : 'var(--text-2)',
                border: '1px solid', borderColor: category === c.id ? 'var(--brand-green)' : 'var(--border-subtle)',
                fontSize: 13, fontWeight: 500, cursor: 'pointer',
                fontFamily: 'var(--font-sans)',
              }}>{c.label}</button>
            ))}
          </div>
        </div>

        <div>
          <div style={{ fontSize: 'var(--t-caption-fs)', color: 'var(--text-meta)', textTransform: 'uppercase', letterSpacing: 1, fontWeight: 600, marginBottom: 8 }}>Beschreibung</div>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Was ist passiert? Welche Schritte hast du gemacht?"
            style={{
              width: '100%', minHeight: 140, padding: 14,
              background: 'var(--subtle)', border: '1px solid var(--border-subtle)',
              borderRadius: 12, color: 'var(--text)', fontSize: 15,
              fontFamily: 'var(--font-sans)', resize: 'vertical', outline: 'none',
            }}
            maxLength={2000}
          />
          <div style={{ fontSize: 'var(--t-caption-fs)', color: 'var(--text-meta)', textAlign: 'right', marginTop: 4 }}>{description.length} / 2000</div>
        </div>

        <button onClick={submit} disabled={sending || description.trim().length < 5} style={{
          width: '100%', padding: 14,
          background: 'var(--brand-green)', color: '#fff', border: 'none',
          borderRadius: 'var(--radius-lg)', fontSize: 15, fontWeight: 600,
          cursor: sending ? 'wait' : 'pointer',
          opacity: description.trim().length < 5 ? 0.5 : 1,
          fontFamily: 'var(--font-sans)',
        }}>
          {sending ? 'Sende…' : 'Absenden'}
        </button>
      </div>
    </div>
  );
}
