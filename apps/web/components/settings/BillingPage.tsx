'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Icon } from '@/components/ui/icon';
import { planLabel } from '@/lib/plan-label';

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? '';

interface BillingStatus {
  plan: string;
  status: string | null;
  trialEndsAt: string | null;
  currentPeriodEnd: string | null;
  cardLast4: string | null;
  cardBrand: string | null;
  isComped: boolean;
  compReason: string | null;
}

interface Invoice {
  id: string;
  date: string;
  amount: number;
  currency: string;
  status: string | null;
  pdf_url: string | null;
  hosted_url: string | null;
}

interface UsageBreakdown {
  byok: number;
  free_api: number;
  goblin_hosted: number;
}

const PLAN_PRICE: Record<string, string> = {
  trial: 'kostenlos',
  build: '$9/Monat',
  pro: '$19/Monat',
  power: '$39/Monat',
};

const PLAN_FEATURES: Record<string, string[]> = {
  trial: ['200 Hosted-Requests', 'Eigene API-Keys erlaubt', 'Limit endet automatisch'],
  build: ['Unbegrenzte Projekte', 'Alle Provider via BYOK', '5 GB Speicher', 'GitHub-Push & Deploy'],
  pro: ['Alles aus Build', 'Cloud-Credits inklusive', 'Priority Support', '20 GB Speicher'],
  power: ['Alles aus Pro', 'Team-Features', 'SLA-Support', '100 GB Speicher'],
};

async function authHeader(): Promise<Record<string, string>> {
  const supabase = createClient();
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return {};
  return { Authorization: `Bearer ${session.access_token}` };
}

export function BillingPage() {
  const [status, setStatus] = useState<BillingStatus | null>(null);
  const [usage, setUsage] = useState<UsageBreakdown | null>(null);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [invoiceCursor, setInvoiceCursor] = useState<string | null>(null);
  const [invoiceHasMore, setInvoiceHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  useEffect(() => { void loadAll(); }, []);

  async function loadAll() {
    const headers = await authHeader();
    if (!headers.Authorization) { setLoading(false); return; }
    try {
      const [statusRes, usageRes, invoicesRes] = await Promise.all([
        fetch(`${API_BASE}/api/billing/status`, { headers }),
        fetch(`${API_BASE}/api/billing/usage`, { headers }),
        fetch(`${API_BASE}/api/billing/invoices`, { headers }),
      ]);
      if (statusRes.ok) setStatus(await statusRes.json());
      if (usageRes.ok) {
        const u = await usageRes.json();
        setUsage(u.breakdown ?? { byok: 0, free_api: 0, goblin_hosted: 0 });
      }
      if (invoicesRes.ok) {
        const inv = await invoicesRes.json();
        setInvoices(inv.invoices ?? []);
        setInvoiceHasMore(!!inv.has_more);
        setInvoiceCursor(inv.next_cursor);
      }
    } finally {
      setLoading(false);
    }
  }

  async function loadMoreInvoices() {
    if (!invoiceCursor || loadingMore) return;
    setLoadingMore(true);
    try {
      const headers = await authHeader();
      const res = await fetch(`${API_BASE}/api/billing/invoices?cursor=${encodeURIComponent(invoiceCursor)}`, { headers });
      if (res.ok) {
        const inv = await res.json();
        setInvoices(prev => [...prev, ...(inv.invoices ?? [])]);
        setInvoiceHasMore(!!inv.has_more);
        setInvoiceCursor(inv.next_cursor);
      }
    } finally { setLoadingMore(false); }
  }

  async function openPortal() {
    setBusy(true);
    try {
      const headers = await authHeader();
      const r = await fetch(`${API_BASE}/api/billing/create-portal-session`, { method: 'POST', headers });
      if (r.ok) {
        const { portalUrl, url } = await r.json();
        const target = portalUrl ?? url;
        if (target) window.location.href = target;
      }
    } finally { setBusy(false); }
  }

  if (loading) {
    return <div style={{ padding: 24, color: 'var(--text-meta)', fontFamily: 'var(--font-sans)' }}>Lade Abrechnung…</div>;
  }

  const planKey = status?.plan ?? 'trial';
  const isComped = !!status?.isComped;
  const planName = planLabel(planKey, isComped);
  const planPrice = PLAN_PRICE[planKey] ?? '';
  const features = PLAN_FEATURES[planKey] ?? [];
  const monthName = new Date().toLocaleDateString('de-DE', { month: 'long', year: 'numeric' });

  // DD §A: usage here is a real BUILD count (sum of the agent_runs tier breakdown),
  // not the retired request counter. The only cap — the weighted Goblin allowance —
  // lives on the dedicated usage screen (Settings → Verbrauch).
  const buildsThisMonth = (usage?.byok ?? 0) + (usage?.free_api ?? 0) + (usage?.goblin_hosted ?? 0);

  return (
    <div className="settings-section" style={{ padding: '0 16px 32px', fontFamily: 'var(--font-sans)' }}>

      {/* Current plan */}
      <Section title="Dein Plan">
        <Card>
          <div style={{ padding: 20 }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, marginBottom: 14 }}>
              <div>
                <div style={{ fontSize: 11, color: 'var(--text-meta)', textTransform: 'uppercase', letterSpacing: 1.2, marginBottom: 6, fontWeight: 600 }}>
                  Aktuell
                </div>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, flexWrap: 'wrap' }}>
                  <div style={{ fontSize: 26, fontWeight: 600, color: 'var(--text)', fontFamily: 'var(--font-sans)', letterSpacing: '-0.3px' }}>
                    {isComped ? 'Vollzugriff' : planName}
                  </div>
                  <div style={{ fontSize: 'var(--t-small-fs)', color: 'var(--text-meta)' }}>
                    {isComped ? (status?.compReason?.startsWith('invite') ? 'Invite-Code' : 'Founder') : planPrice}
                  </div>
                </div>
                {!isComped && status?.trialEndsAt && (
                  <div style={{ marginTop: 8, fontSize: 13, color: 'var(--brand-gold)' }}>
                    Trial endet {new Date(status.trialEndsAt).toLocaleDateString('de-DE')}
                  </div>
                )}
                {!isComped && status?.currentPeriodEnd && !status?.trialEndsAt && (
                  <div style={{ marginTop: 8, fontSize: 13, color: 'var(--text-meta)' }}>
                    Nächste Abbuchung {new Date(status.currentPeriodEnd).toLocaleDateString('de-DE')}
                  </div>
                )}
              </div>
            </div>

            {/* Feature list */}
            <ul style={{ listStyle: 'none', padding: 0, margin: '12px 0 16px', display: 'flex', flexDirection: 'column', gap: 6 }}>
              {(isComped ? ['Unbegrenzte Projekte', 'Alle Provider', 'Voller Speicher', 'Alle Features'] : features).map(f => (
                <li key={f} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: 'var(--text)' }}>
                  <Icon name="check" size={14} color="var(--brand-green)" />
                  {f}
                </li>
              ))}
            </ul>

            {!isComped && (
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <button onClick={openPortal} disabled={busy} style={primaryBtn(busy)}>
                  {busy ? 'Lade Portal…' : 'Abo verwalten'}
                </button>
                <button onClick={() => { window.location.href = '/dashboard/upgrade'; }} style={outlineBtn}>
                  Plan ändern
                </button>
              </div>
            )}
          </div>
        </Card>
      </Section>

      {/* Usage — a plain BUILD count this month. The real limit (the weighted Goblin
          allowance) lives on the Verbrauch screen, not here. */}
      <Section title={`Verbrauch — ${monthName}`}>
        <Card>
          <div style={{ padding: 20, display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 12 }}>
            <div style={{ fontSize: 'var(--t-small-fs)', color: 'var(--text)' }}>
              {isComped ? 'Unbegrenzt' : 'Diesen Monat'}
            </div>
            <div style={{ fontSize: 15, color: 'var(--text)', fontFamily: 'var(--font-mono, monospace)' }}>
              {buildsThisMonth} {buildsThisMonth === 1 ? 'Build' : 'Builds'}
            </div>
          </div>
        </Card>

        {/* Stat cards — builds by source. */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, marginTop: 10 }}>
          <StatCard icon="apiKey" label="BYOK" value={usage?.byok ?? 0} />
          <StatCard icon="fast" label="Free" value={usage?.free_api ?? 0} />
          <StatCard icon="rocket" label="Goblin" value={usage?.goblin_hosted ?? 0} />
        </div>
      </Section>

      {/* Payment method */}
      <Section title="Zahlungsmethode">
        <Card>
          <div style={{ padding: 20 }}>
            {isComped ? (
              <div style={{ fontSize: 'var(--t-small-fs)', color: 'var(--text-meta)' }}>Nicht erforderlich</div>
            ) : status?.cardLast4 ? (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <Icon name="billing" size={18} color="var(--text-meta)" />
                  <div>
                    <div style={{ fontSize: 'var(--t-small-fs)', color: 'var(--text)', fontFamily: 'var(--font-mono, monospace)' }}>
                      {(status.cardBrand ?? '').toUpperCase()} •••• {status.cardLast4}
                    </div>
                  </div>
                </div>
                <button onClick={openPortal} disabled={busy} style={textBtn}>Ändern</button>
              </div>
            ) : (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                <div style={{ fontSize: 'var(--t-small-fs)', color: 'var(--text-meta)' }}>Keine Zahlungsmethode</div>
                <button onClick={openPortal} disabled={busy} style={outlineBtn}>Hinzufügen</button>
              </div>
            )}
          </div>
        </Card>
      </Section>

      {/* Billing history */}
      <Section title="Rechnungs-Historie">
        <Card>
          {invoices.length === 0 ? (
            <div style={{ padding: 20, fontSize: 'var(--t-small-fs)', color: 'var(--text-meta)' }}>Noch keine Rechnungen</div>
          ) : (
            <>
              <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                {invoices.map(inv => (
                  <li key={inv.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 20px', borderBottom: '1px solid var(--rule, rgba(0,0,0,0.06))', gap: 12 }}>
                    <div>
                      <div style={{ fontSize: 'var(--t-small-fs)', color: 'var(--text)' }}>
                        {new Date(inv.date).toLocaleDateString('de-DE', { day: '2-digit', month: 'short', year: 'numeric' })}
                      </div>
                      <div style={{ fontSize: 'var(--t-caption-fs)', color: 'var(--text-meta)', marginTop: 2 }}>
                        {inv.status === 'paid' ? 'Bezahlt' : inv.status ?? '—'}
                      </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <div style={{ fontSize: 'var(--t-small-fs)', color: 'var(--text)', fontFamily: 'var(--font-mono, monospace)' }}>
                        {inv.amount.toFixed(2)} {inv.currency.toUpperCase()}
                      </div>
                      {inv.pdf_url && (
                        <a href={inv.pdf_url} target="_blank" rel="noreferrer" style={{ color: 'var(--text-meta)', display: 'inline-flex', alignItems: 'center' }} aria-label="PDF öffnen">
                          <Icon name="download" size={16} />
                        </a>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
              {invoiceHasMore && (
                <div style={{ padding: 12, textAlign: 'center' }}>
                  <button onClick={loadMoreInvoices} disabled={loadingMore} style={textBtn}>
                    {loadingMore ? 'Lade…' : 'Mehr laden'}
                  </button>
                </div>
              )}
            </>
          )}
        </Card>
      </Section>

      {!isComped && <InviteCodeRedemption />}

      <p className="helper-text" style={{ fontSize: 'var(--t-caption-fs)', color: 'var(--text-meta)', marginTop: 20, padding: '0 4px', lineHeight: 1.6 }}>
        Sicheres Checkout & Rechnungen über Stripe. Kündigung jederzeit im Kundenportal.
      </p>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section style={{ marginBottom: 24 }}>
      <h3 style={{ fontSize: 'var(--t-caption-fs)', fontWeight: 600, color: 'var(--text-meta)', textTransform: 'uppercase', letterSpacing: 1.2, margin: '0 0 10px', padding: '0 4px' }}>
        {title}
      </h3>
      {children}
    </section>
  );
}

function Card({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ background: 'var(--surface)', border: '1px solid var(--rule, rgba(0,0,0,0.08))', borderRadius: 12, overflow: 'hidden' }}>
      {children}
    </div>
  );
}

function StatCard({ icon, label, value }: { icon: 'apiKey' | 'fast' | 'rocket'; label: string; value: number }) {
  return (
    <div style={{ background: 'var(--surface)', border: '1px solid var(--rule, rgba(0,0,0,0.08))', borderRadius: 12, padding: 14, display: 'flex', flexDirection: 'column', gap: 6 }}>
      <Icon name={icon} size={16} color="var(--brand-green)" />
      <div style={{ fontSize: 22, fontWeight: 600, color: 'var(--text)', fontFamily: 'var(--font-sans)', lineHeight: 1.1 }}>{value}</div>
      <div style={{ fontSize: 11, color: 'var(--text-meta)', textTransform: 'uppercase', letterSpacing: 0.8 }}>{label}</div>
    </div>
  );
}

const primaryBtn = (busy: boolean): React.CSSProperties => ({
  padding: '8px 16px',
  background: 'var(--brand-green)',
  color: 'var(--brand-gold)',
  border: 'none',
  borderRadius: 8,
  fontSize: 13,
  fontWeight: 600,
  cursor: busy ? 'wait' : 'pointer',
  opacity: busy ? 0.6 : 1,
  fontFamily: 'var(--font-sans)',
});

const outlineBtn: React.CSSProperties = {
  padding: '8px 16px',
  background: 'transparent',
  color: 'var(--text)',
  border: '1px solid var(--rule, rgba(0,0,0,0.15))',
  borderRadius: 8,
  fontSize: 13,
  fontWeight: 500,
  cursor: 'pointer',
  fontFamily: 'var(--font-sans)',
};

const textBtn: React.CSSProperties = {
  padding: '6px 10px',
  background: 'transparent',
  color: 'var(--brand-green)',
  border: 'none',
  fontSize: 13,
  fontWeight: 500,
  cursor: 'pointer',
  fontFamily: 'var(--font-sans)',
};

function InviteCodeRedemption() {
  const [open, setOpen] = useState(false);
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);

  async function redeem() {
    setBusy(true);
    setMsg(null);
    try {
      const headers = await authHeader();
      const r = await fetch(`${API_BASE}/api/account/redeem-invite`, {
        method: 'POST',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: code.trim() }),
      });
      const data = await r.json().catch(() => ({}));
      if (r.ok) {
        setMsg({ kind: 'ok', text: 'Code eingelöst. Seite wird neu geladen…' });
        setTimeout(() => window.location.reload(), 1200);
      } else {
        setMsg({ kind: 'err', text: data?.error ?? 'Einlösung fehlgeschlagen' });
      }
    } catch {
      setMsg({ kind: 'err', text: 'Netzwerkfehler' });
    } finally { setBusy(false); }
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        style={{
          marginTop: 8,
          background: 'none',
          border: 'none',
          color: 'var(--text-meta)',
          fontSize: 13,
          cursor: 'pointer',
          padding: '4px 0',
          textDecoration: 'underline',
          fontFamily: 'var(--font-sans)',
        }}
      >
        Hast du einen Invite-Code?
      </button>
    );
  }

  return (
    <div style={{ marginTop: 8, padding: 16, border: '1px solid var(--rule, rgba(0,0,0,0.1))', borderRadius: 10, background: 'var(--surface)' }}>
      <div style={{ fontSize: 13, color: 'var(--text)', marginBottom: 8, fontWeight: 600 }}>Invite-Code einlösen</div>
      <div style={{ display: 'flex', gap: 8 }}>
        <input
          type="text"
          value={code}
          onChange={(e) => setCode(e.target.value)}
          placeholder="GOBLIN-..."
          autoFocus
          style={{
            flex: 1,
            padding: '8px 12px',
            border: '1px solid var(--rule, rgba(0,0,0,0.15))',
            borderRadius: 8,
            background: 'var(--bg)',
            color: 'var(--text)',
            fontSize: 'var(--t-small-fs)',
            fontFamily: 'var(--font-mono, monospace)',
            textTransform: 'uppercase',
          }}
        />
        <button onClick={redeem} disabled={busy || code.trim().length < 3} style={primaryBtn(busy)}>
          {busy ? '…' : 'Einlösen'}
        </button>
      </div>
      {msg && (
        <div style={{ marginTop: 8, fontSize: 'var(--t-caption-fs)', color: msg.kind === 'ok' ? 'var(--brand-green)' : 'var(--danger, #c64a4a)' }}>
          {msg.text}
        </div>
      )}
    </div>
  );
}
