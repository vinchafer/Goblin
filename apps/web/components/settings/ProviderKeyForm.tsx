'use client';

import { useState } from 'react';
import { Eye, EyeSlash, Warning, CircleNotch, ArrowSquareOut, CheckCircle } from '@phosphor-icons/react';
import { createClient } from '@/lib/supabase/client';

// Where to grab a key per provider — shown inline so the user never leaves to hunt.
const PROVIDER_KEY_URLS: Record<string, { url: string; label: string }> = {
  anthropic: { url: 'https://console.anthropic.com/settings/keys', label: 'Anthropic Console' },
  openai: { url: 'https://platform.openai.com/api-keys', label: 'OpenAI Platform' },
  google: { url: 'https://aistudio.google.com/app/apikey', label: 'Google AI Studio' },
  groq: { url: 'https://console.groq.com/keys', label: 'Groq Console' },
  mistral: { url: 'https://console.mistral.ai/api-keys/', label: 'Mistral Console' },
  deepseek: { url: 'https://platform.deepseek.com/api_keys', label: 'DeepSeek Platform' },
  xai: { url: 'https://console.x.ai/', label: 'xAI Console' },
  together: { url: 'https://api.together.xyz/settings/api-keys', label: 'Together AI' },
};

interface Props {
  provider: string;
  providerLabel: string;
  /** last-4 hint of an already-connected key — switches the form to "manage" mode */
  existingHint?: string | null;
  /** called after a successful add or remove so the parent list can refetch */
  onSaved: () => void;
  /** called to pop the sheet back to the list */
  onBack: () => void;
}

// Map the API's terse errors onto something a non-technical user can act on.
function friendly(raw: string): string {
  const m = raw.toLowerCase();
  if (m.includes('invalid')) return 'Der Key wurde vom Provider abgelehnt. Prüfe, ob du ihn vollständig kopiert hast.';
  if (m.includes('timed out') || m.includes('timeout')) return 'Provider antwortet nicht (Timeout). Key ist evtl. gültig — bitte gleich nochmal versuchen.';
  if (m.includes('maximum') || m.includes('max.')) return 'Maximal 2 Keys pro Anbieter erreicht. Du kannst den ältesten ersetzen.';
  if (m.includes('validate')) return 'Konnte den Key nicht beim Provider prüfen. Netzwerkproblem — bitte nochmal versuchen.';
  return raw;
}

// The backend cap is 2 keys per provider. Its limit error carries this marker in
// both languages; we key off it to switch the form into the replace-offer mode.
function isLimitError(raw: string): boolean {
  const m = raw.toLowerCase();
  return m.includes('maximum') || m.includes('max.');
}

export function ProviderKeyForm({ provider, providerLabel, existingHint, onSaved, onBack }: Props) {
  const [key, setKey] = useState('');
  const [label, setLabel] = useState('');
  const [showKey, setShowKey] = useState(false);
  const [loading, setLoading] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [replacing, setReplacing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Set when the backend rejects the add because the provider is at its 2-key cap.
  // Switches the form into "replace the oldest key" mode instead of a dead-end error.
  const [atLimit, setAtLimit] = useState(false);
  // 10.8-4: after a successful connect we show the models THIS key unlocked
  // (discovered live from the provider) instead of bouncing straight back.
  const [discovered, setDiscovered] = useState<string[] | null>(null);

  const apiBase = process.env.NEXT_PUBLIC_API_URL ?? '';
  const keyUrl = PROVIDER_KEY_URLS[provider];

  async function authToken(): Promise<string | null> {
    const supabase = createClient();
    const { data: { session } } = await supabase.auth.getSession();
    return session?.access_token ?? null;
  }

  // Core add — POSTs the key and handles the success/discovered-models path.
  // Returns true on success, false on a handled error (error state already set).
  // On the 2-key cap it flips atLimit so the caller can offer a replace.
  async function postKey(token: string): Promise<boolean> {
    const res = await fetch(`${apiBase}/api/byok-keys`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ provider, label: label.trim() || providerLabel, key: key.trim() }),
    });

    if (!res.ok) {
      let msg = 'Key konnte nicht gespeichert werden';
      try { const d = await res.json(); msg = d.error || msg; } catch { /* non-JSON */ }
      if (isLimitError(msg)) setAtLimit(true);
      setError(friendly(msg));
      return false;
    }
    // Parse the discovered model list off the created key (10.8-2 backend).
    let models: string[] = [];
    try {
      const created = await res.json();
      if (Array.isArray(created?.discovered_models)) models = created.discovered_models as string[];
    } catch { /* non-JSON — fine, fall through with empty list */ }
    onSaved(); // let the parent list refetch immediately
    if (models.length > 0) {
      setDiscovered(models); // show the unlocked-models panel; user dismisses
    } else {
      onBack();
    }
    return true;
  }

  // Revoke the OLDEST active key for this provider so the new one fits under the cap.
  // listKeys returns newest-first → the last active row is the oldest.
  async function revokeOldestForProvider(token: string): Promise<boolean> {
    const listRes = await fetch(`${apiBase}/api/byok-keys`, { headers: { Authorization: `Bearer ${token}` } });
    const rows = listRes.ok ? await listRes.json() : [];
    const active = (rows as { id: string; provider: string; status?: string }[])
      .filter(r => r.provider === provider && r.status !== 'revoked');
    const oldest = active[active.length - 1];
    if (!oldest) return false;
    const del = await fetch(`${apiBase}/api/byok-keys/${oldest.id}`, {
      method: 'DELETE', headers: { Authorization: `Bearer ${token}` },
    });
    return del.ok;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setAtLimit(false);
    try {
      const token = await authToken();
      if (!token) { setError('Nicht angemeldet. Bitte neu einloggen.'); return; }
      await postKey(token);
    } catch {
      setError('Netzwerkfehler. Bitte nochmal versuchen.');
    } finally {
      setLoading(false);
    }
  }

  // Replace-offer: drop the oldest key for this provider, then retry the add.
  async function handleReplace() {
    setReplacing(true);
    setError(null);
    try {
      const token = await authToken();
      if (!token) { setError('Nicht angemeldet. Bitte neu einloggen.'); return; }
      const ok = await revokeOldestForProvider(token);
      if (!ok) { setError('Konnte den bestehenden Key nicht ersetzen.'); return; }
      onSaved(); // list changed — let parent refetch
      setAtLimit(false);
      await postKey(token);
    } catch {
      setError('Netzwerkfehler. Bitte nochmal versuchen.');
    } finally {
      setReplacing(false);
    }
  }

  async function handleRemove() {
    setRemoving(true);
    setError(null);
    try {
      const token = await authToken();
      if (!token) { setError('Nicht angemeldet. Bitte neu einloggen.'); return; }
      // Look up the key id, then revoke. listKeys returns the active rows.
      const listRes = await fetch(`${apiBase}/api/byok-keys`, { headers: { Authorization: `Bearer ${token}` } });
      const rows = listRes.ok ? await listRes.json() : [];
      const row = (rows as { id: string; provider: string; status?: string }[])
        .find(r => r.provider === provider && r.status !== 'revoked');
      if (row) {
        await fetch(`${apiBase}/api/byok-keys/${row.id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } });
      }
      onSaved();
      onBack();
    } catch {
      setError('Konnte den Key nicht entfernen.');
    } finally {
      setRemoving(false);
    }
  }

  const inputStyle: React.CSSProperties = {
    width: '100%', padding: '11px 12px',
    background: 'var(--subtle)', border: '1px solid var(--border-subtle)',
    borderRadius: 10, color: 'var(--text)', fontSize: 15,
    fontFamily: 'var(--font-sans)', outline: 'none',
  };

  // 10.8-4: connected — show exactly what this key unlocks (no hardcoded promise).
  if (discovered) {
    const shown = discovered.slice(0, 14);
    const rest = discovered.length - shown.length;
    return (
      <div style={{ padding: '4px 16px 24px', fontFamily: 'var(--font-sans)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
          <CheckCircle size={22} weight="fill" style={{ color: 'var(--brand-green)' }} />
          <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)' }}>
            Verbunden — {discovered.length} {discovered.length === 1 ? 'Modell' : 'Modelle'} verfügbar
          </span>
        </div>
        <p style={{ fontSize: 13, color: 'var(--text-meta)', margin: '0 0 14px', lineHeight: 1.5 }}>
          Dein {providerLabel}-Key schaltet diese Modelle frei. Du findest sie ab jetzt im Modell-Auswahlmenü.
        </p>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 20 }}>
          {shown.map((m) => (
            <span key={m} style={{
              fontFamily: 'var(--font-mono)', fontSize: 12, padding: '4px 8px', borderRadius: 6,
              background: 'var(--subtle)', border: '1px solid var(--border-subtle)', color: 'var(--text)',
            }}>{m}</span>
          ))}
          {rest > 0 && (
            <span style={{ fontSize: 12, padding: '4px 8px', color: 'var(--text-meta)' }}>+{rest} weitere</span>
          )}
        </div>
        <button
          type="button"
          onClick={onBack}
          style={{
            width: '100%', padding: '13px', borderRadius: 10, border: 'none',
            background: 'var(--brand-green)', color: '#fff', fontSize: 15, fontWeight: 600,
            cursor: 'pointer', fontFamily: 'var(--font-sans)',
          }}
        >Fertig</button>
      </div>
    );
  }

  return (
    <div style={{ padding: '4px 16px 24px', fontFamily: 'var(--font-sans)' }}>
      {existingHint && (
        <div style={{
          background: 'color-mix(in srgb, var(--brand-green) 8%, transparent)',
          border: '1px solid color-mix(in srgb, var(--brand-green) 24%, transparent)',
          borderRadius: 10, padding: '10px 14px', marginBottom: 16,
          fontSize: 13, color: 'var(--text)',
        }}>
          {providerLabel} ist verbunden — <span style={{ fontFamily: 'var(--font-mono)' }}>…{existingHint}</span>.
          Du kannst den Key ersetzen oder entfernen.
        </div>
      )}

      <p style={{ fontSize: 13, color: 'var(--text-meta)', margin: '0 0 16px', lineHeight: 1.5 }}>
        Verbinde deinen {providerLabel}-Key → Zugriff auf alle {providerLabel}-Modelle, die dein Key freischaltet.
        Der Key wird verschlüsselt gespeichert und nur genutzt, um {providerLabel} in deinem Auftrag aufzurufen —
        niemals weiterverkauft.
      </p>

      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>API-Key</span>
          <div style={{ position: 'relative' }}>
            <input
              type={showKey ? 'text' : 'password'}
              value={key}
              onChange={(e) => setKey(e.target.value)}
              placeholder="sk-…"
              autoComplete="off"
              data-testid="provider-key-input"
              style={{ ...inputStyle, paddingRight: 44, fontFamily: 'var(--font-mono)' }}
              required
            />
            <button
              type="button"
              onClick={() => setShowKey(s => !s)}
              aria-label={showKey ? 'Key verbergen' : 'Key anzeigen'}
              style={{
                position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)',
                background: 'transparent', border: 'none', cursor: 'pointer', display: 'flex', padding: 4,
              }}
            >
              {showKey
                ? <EyeSlash size={18} style={{ color: 'var(--text-meta)' }} />
                : <Eye size={18} style={{ color: 'var(--text-meta)' }} />}
            </button>
          </div>
        </label>

        <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>Label (optional)</span>
          <input
            type="text"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder={`z.B. Mein ${providerLabel}-Key`}
            maxLength={50}
            style={inputStyle}
          />
        </label>

        {keyUrl && (
          <div style={{ fontSize: 13 }}>
            <span style={{ color: 'var(--text-meta)' }}>Noch keinen Key? Hol dir einen bei </span>
            <a href={keyUrl.url} target="_blank" rel="noopener noreferrer"
              style={{ color: 'var(--brand-green)', fontWeight: 600, textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
              {keyUrl.label} <ArrowSquareOut size={13} />
            </a>
          </div>
        )}

        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, fontSize: 12, color: 'var(--text-meta)' }}>
          <Warning size={16} style={{ color: 'var(--danger, #B85C3C)', flexShrink: 0, marginTop: 1 }} />
          <span>Teile diesen Key niemals öffentlich.</span>
        </div>

        {error && (
          <div role="alert" data-testid="provider-key-error" style={{
            padding: '10px 14px', borderRadius: 10, fontSize: 13, lineHeight: 1.4,
            background: 'rgba(184,92,60,0.10)', color: 'var(--danger, #B85C3C)',
          }}>{error}</div>
        )}

        {atLimit && (
          <button
            type="button"
            onClick={handleReplace}
            disabled={loading || replacing || !key.trim()}
            data-testid="provider-key-replace"
            style={{
              width: '100%', padding: '12px', borderRadius: 10, border: 'none',
              background: 'var(--brand-green)', color: '#fff', fontSize: 14, fontWeight: 600,
              cursor: replacing || !key.trim() ? 'not-allowed' : 'pointer',
              opacity: replacing || !key.trim() ? 0.55 : 1,
              fontFamily: 'var(--font-sans)',
            }}
          >{replacing ? 'Ersetze…' : 'Ältesten Key durch diesen ersetzen'}</button>
        )}

        <button
          type="submit"
          disabled={loading || removing || replacing || !key.trim()}
          data-testid="provider-key-submit"
          style={{
            width: '100%', padding: '13px', borderRadius: 10, border: 'none',
            background: 'var(--brand-green)', color: '#fff', fontSize: 15, fontWeight: 600,
            cursor: loading || !key.trim() ? 'not-allowed' : 'pointer', opacity: loading || !key.trim() ? 0.55 : 1,
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            fontFamily: 'var(--font-sans)',
          }}
        >
          {loading ? <><CircleNotch size={16} className="animate-spin" /> Prüfe Key…</> : 'Verbinden →'}
        </button>

        {existingHint && (
          <button
            type="button"
            onClick={handleRemove}
            disabled={loading || removing}
            style={{
              width: '100%', padding: '11px', borderRadius: 10,
              background: 'transparent', border: '1px solid var(--border-subtle)',
              color: 'var(--danger, #B85C3C)', fontSize: 14, fontWeight: 600,
              cursor: removing ? 'not-allowed' : 'pointer', fontFamily: 'var(--font-sans)',
            }}
          >{removing ? 'Entferne…' : 'Key entfernen'}</button>
        )}
      </form>
    </div>
  );
}
