'use client';

import { useCallback, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';

// Stack recommendations Goblin pre-selects based on a freeform description.
// Heuristic keyword match — keeps the UI honest: it is a recommendation,
// not magic. The user can override.
const STACKS = [
  { id: 'next',    name: 'Next.js',     sub: 'APP ROUTER · TS',  why: 'Beste Wahl für Web-Apps mit Auth, API und schneller Vercel-Deploy.' },
  { id: 'astro',   name: 'Astro',       sub: 'CONTENT-FIRST',    why: 'Für Landingpages und Blogs — minimal JS, blitzschnell.' },
  { id: 'express', name: 'Express API', sub: 'NODE · TS',        why: 'Wenn du nur eine API brauchst — keine Frontend-Last.' },
] as const;
type StackId = typeof STACKS[number]['id'];

function recommendStack(description: string): StackId {
  const t = description.toLowerCase();
  if (/\b(api|endpoint|backend|webhook|server|rest|graphql)\b/.test(t) && !/\b(seite|page|ui|frontend|landing)\b/.test(t)) return 'express';
  if (/\b(landing|blog|portfolio|content|marketing|seite)\b/.test(t) && !/\b(auth|login|stripe|dashboard|app)\b/.test(t)) return 'astro';
  return 'next';
}

const TAG_COLORS = [
  { name: 'Grün',     value: '#2f6a47' },
  { name: 'Gold',     value: '#D4A737' },
  { name: 'Lila',     value: '#7A4A8A' },
  { name: 'Blau',     value: '#3A6B8A' },
  { name: 'Rot',      value: '#a04230' },
  { name: 'Petrol',   value: '#4A7A7A' },
];

export default function NewProjectPage() {
  const router = useRouter();
  const supabase = createClient();

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [stack, setStack] = useState<StackId | null>(null);
  const [pastedContext, setPastedContext] = useState('');
  const [labelText, setLabelText] = useState('');
  const [color, setColor] = useState<string>(TAG_COLORS[0]!.value);
  const [stackExpanded, setStackExpanded] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // The recommendation: derived from description, but overridable. Once the
  // user explicitly picks a stack, we respect their choice forever.
  const effectiveStack: StackId = stack ?? recommendStack(description);
  const recommended = STACKS.find(s => s.id === effectiveStack)!;

  const submit = useCallback(async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!name.trim() || loading) return;
    setLoading(true);
    setError('');
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { router.push('/login'); return; }

      const apiBase = process.env.NEXT_PUBLIC_API_URL;
      if (!apiBase) {
        setError('NEXT_PUBLIC_API_URL fehlt — Vercel-Env prüfen.');
        setLoading(false);
        return;
      }

      // Fold context + label into description — the backend has no dedicated
      // columns for them (deferred per recon Q1 / deferred follow-up).
      // Format keeps them parseable later without losing the user's text.
      const parts: string[] = [];
      if (description.trim()) parts.push(description.trim());
      if (labelText.trim()) parts.push(`Label: ${labelText.trim()}`);
      if (pastedContext.trim()) {
        parts.push(`--- Importierter Kontext ---\n${pastedContext.trim()}\n--- Ende ---`);
      }
      parts.push(`Stack-Empfehlung: ${recommended.name}`);
      const fullDescription = parts.join('\n\n');

      const res = await fetch(`${apiBase}/api/projects`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({
          name: name.trim(),
          description: fullDescription.slice(0, 500),
          color,
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setError(body.error || 'Projekt konnte nicht erstellt werden.');
        setLoading(false);
        return;
      }
      const created = await res.json() as { id: string };
      router.push(`/dashboard/project/${created.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Etwas ist schiefgelaufen.');
      setLoading(false);
    }
  }, [name, description, labelText, pastedContext, color, recommended, loading, router, supabase]);

  const onFileDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (!file) return;
    if (file.size > 200_000) {
      setError(`${file.name} ist zu groß (max 200 KB als Kontext)`);
      return;
    }
    file.text().then(t => {
      setPastedContext(prev => prev ? `${prev}\n\n${t}` : t);
      setError('');
    });
  };

  return (
    <div style={{ height: '100%', overflowY: 'auto', background: 'var(--d-surface)' }}>
      <div style={{ maxWidth: 760, margin: '0 auto', padding: '40px 32px 80px' }}>

        <Link href="/dashboard" style={{
          display: 'inline-flex', alignItems: 'center', gap: 6,
          fontFamily: 'JetBrains Mono, monospace', fontSize: 10.5,
          letterSpacing: '0.14em', textTransform: 'uppercase',
          color: 'var(--ink-3)', marginBottom: 28, textDecoration: 'none',
        }}>
          ← Zurück zum Dashboard
        </Link>

        <div className="gobl-eyebrow" style={{ marginBottom: 14 }}>
          <span className="tick" />
          <span className="num">/NEU</span>
          Projekt anlegen
        </div>
        <h1 style={{
          fontFamily: 'var(--font-dash-display), Manrope, sans-serif',
          fontWeight: 600, fontSize: 'clamp(36px, 4vw, 56px)',
          letterSpacing: '-0.034em', lineHeight: 1.06,
          color: 'var(--ink-1)', margin: '0 0 12px',
        }}>
          Nenn deine <span className="gobl-serif">Werkstatt.</span>
        </h1>
        <p style={{
          fontSize: 17, color: 'var(--ink-2)', maxWidth: '52ch',
          margin: '0 0 40px', lineHeight: 1.5,
        }}>
          Den Namen wählst du. Goblin schlägt einen Tech-Stack vor — kannst du jederzeit ändern. Alles andere ist optional.
        </p>

        <form onSubmit={submit} className="gobl-panel" style={{ padding: 28 }}>
          <div style={{ marginBottom: 22 }}>
            <label className="gobl-field-label" htmlFor="np-name">
              Name <span style={{ color: 'var(--danger)' }}>*</span>
            </label>
            <input
              id="np-name"
              type="text"
              className="gobl-input"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="Newsletter-Tool"
              autoFocus
              required
              maxLength={100}
            />
          </div>

          <div style={{ marginBottom: 22 }}>
            <label className="gobl-field-label" htmlFor="np-desc">
              Was willst du bauen?
            </label>
            <textarea
              id="np-desc"
              className="gobl-textarea"
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="Ein Newsletter mit Stripe-Bezahlung und Magic-Link-Login."
              rows={3}
            />
          </div>

          <div style={{ marginBottom: 22 }}>
            <label className="gobl-field-label">Tech-Stack</label>
            <div className="gobl-panel" style={{
              padding: 14, background: 'var(--d-surface)',
              display: 'flex', alignItems: 'center', gap: 14,
            }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{
                  fontFamily: 'var(--font-dash-display), Manrope, sans-serif',
                  fontWeight: 600, fontSize: 'var(--t-small-fs)', color: 'var(--ink-1)', marginBottom: 2,
                }}>
                  Empfehlung: {recommended.name}
                </div>
                <div style={{ fontSize: 12.5, color: 'var(--ink-3)', lineHeight: 1.45 }}>
                  {recommended.why}
                </div>
              </div>
              <button type="button" onClick={() => setStackExpanded(s => !s)} className="gobl-btn ghost sm">
                {stackExpanded ? 'Schließen' : 'Ändern'}
              </button>
            </div>
            {stackExpanded && (
              <div style={{
                display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
                gap: 8, marginTop: 10,
              }}>
                {STACKS.map(s => {
                  const active = effectiveStack === s.id;
                  return (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => { setStack(s.id); setStackExpanded(false); }}
                      style={{
                        background: active ? 'var(--d-surface-elev)' : 'var(--d-surface)',
                        border: `1px solid ${active ? 'var(--ink-1)' : 'var(--line)'}`,
                        boxShadow: active ? '0 0 0 1px var(--ink-1)' : 'none',
                        borderRadius: 'var(--radius)', padding: 12,
                        textAlign: 'left', cursor: 'pointer',
                      }}
                    >
                      <div style={{ fontFamily: 'var(--font-dash-display), Manrope, sans-serif', fontWeight: 600, fontSize: 13.5, color: 'var(--ink-1)', marginBottom: 2 }}>
                        {s.name}
                      </div>
                      <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 10, letterSpacing: '0.10em', textTransform: 'uppercase', color: 'var(--ink-3)' }}>
                        {s.sub}
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          <div style={{ marginBottom: 22 }}>
            <label className="gobl-field-label">Vorhandenen Kontext mitgeben — optional</label>
            <div
              onDragOver={e => e.preventDefault()}
              onDrop={onFileDrop}
              style={{
                border: '1px dashed var(--line-strong)', borderRadius: 'var(--radius)',
                padding: '14px 16px', background: 'var(--d-surface)',
                fontSize: 12.5, color: 'var(--ink-3)', marginBottom: 8,
              }}
            >
              Ziehe eine Datei hierher (max 200 KB) oder füge unten eine vergangene Konversation ein.
            </div>
            <textarea
              className="gobl-textarea"
              value={pastedContext}
              onChange={e => setPastedContext(e.target.value)}
              placeholder="Hier eine alte Goblin/ChatGPT/Claude-Konversation oder Notizen einfügen…"
              rows={4}
              style={{ minHeight: 80 }}
            />
          </div>

          <div style={{ marginBottom: 22, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <div>
              <label className="gobl-field-label">Farbe — optional</label>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {TAG_COLORS.map(c => (
                  <button
                    key={c.value}
                    type="button"
                    aria-label={c.name}
                    title={c.name}
                    onClick={() => setColor(c.value)}
                    style={{
                      width: 26, height: 26, borderRadius: '50%',
                      background: c.value, border: 'none', cursor: 'pointer',
                      boxShadow: color === c.value ? '0 0 0 2px var(--ink-1), 0 0 0 4px var(--d-surface)' : 'none',
                    }}
                  />
                ))}
              </div>
            </div>
            <div>
              <label className="gobl-field-label" htmlFor="np-label">Label — optional</label>
              <input
                id="np-label"
                type="text"
                className="gobl-input"
                value={labelText}
                onChange={e => setLabelText(e.target.value)}
                placeholder="z. B. Kundenarbeit"
                maxLength={40}
              />
            </div>
          </div>

          {error && (
            <div style={{
              background: 'var(--danger-soft)', border: '1px solid rgba(160,66,48,.30)',
              borderRadius: 'var(--radius)', padding: 12, fontSize: 13,
              color: 'var(--danger)', marginBottom: 16,
            }}>
              {error}
            </div>
          )}

          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
            marginTop: 24, paddingTop: 20, borderTop: '1px solid var(--line)',
          }}>
            <span style={{
              fontFamily: 'JetBrains Mono, monospace', fontSize: 10.5,
              letterSpacing: '0.10em', textTransform: 'uppercase', color: 'var(--ink-3)',
            }}>
              Senden ⌘ + ↵
            </span>
            <button type="submit" className="gobl-btn primary lg" disabled={!name.trim() || loading}>
              {loading ? 'Erstelle …' : 'Projekt anlegen →'}
            </button>
          </div>
        </form>

        {/* B5 reassurance (R2): trial is free, no card — sits calmly below the CTA */}
        <p style={{
          marginTop: 16, textAlign: 'center',
          fontSize: 13, lineHeight: 1.5, color: 'var(--ink-2)',
        }}>
          Dein erster Build ist kostenlos – 3 Tage Goblin Cloud gratis, keine Karte nötig.
        </p>
      </div>
    </div>
  );
}
