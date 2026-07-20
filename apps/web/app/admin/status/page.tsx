'use client';

import { useEffect, useState, useCallback } from 'react';
import { readMutationError } from '@/lib/admin/mutation-error';

const ADMIN_BASE = '/api/admin';
const adminHeaders = () => ({ 'Content-Type': 'application/json' });

// U5.1: shared honest-error banner style.
const ERR_BANNER: React.CSSProperties = {
  background: 'rgba(176,67,42,0.10)', border: '1px solid var(--danger)',
  color: 'var(--danger)', borderRadius: 8, padding: '10px 14px', marginBottom: 16,
  fontSize: 13, fontFamily: 'var(--font-sans)', fontWeight: 500,
};

interface Incident {
  id: string;
  title: string;
  status: string;
  severity: string;
  description: string | null;
  resolved_at: string | null;
  created_at: string;
  updated_at: string;
}

const STATUS_OPTIONS = ['investigating', 'identified', 'monitoring', 'resolved'];
const SEVERITY_OPTIONS = ['minor', 'major', 'critical'];

const STATUS_COLOR: Record<string, string> = {
  investigating: 'var(--danger)',
  identified:    'var(--brand-gold)',
  monitoring:    '#3A6B8A',
  resolved:      'var(--success)',
};

const SEVERITY_COLOR: Record<string, string> = {
  minor:    '#8aaa85',
  major:    'var(--brand-gold)',
  critical: 'var(--danger)',
};

const BLANK = { title: '', status: 'investigating', severity: 'minor', description: '' };

export default function AdminStatusPage() {
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [loading, setLoading] = useState(true);
  const [showNew, setShowNew] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState(BLANK);
  const [saving, setSaving] = useState(false);
  const [mutError, setMutError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch(`${ADMIN_BASE}/incidents`, { headers: adminHeaders() });
    if (res.ok) setIncidents(await res.json());
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  // U5.1: confirm the write before closing the modal — a failed save used to
  // close + reload as if the incident was created/updated.
  const handleSave = async () => {
    setSaving(true);
    setMutError(null);
    try {
      const res = editId
        ? await fetch(`${ADMIN_BASE}/incidents/${editId}`, { method: 'PATCH', headers: adminHeaders(), body: JSON.stringify(form) })
        : await fetch(`${ADMIN_BASE}/incidents`, { method: 'POST', headers: adminHeaders(), body: JSON.stringify(form) });
      const err = await readMutationError(res, 'en');
      if (err) { setMutError(err); return; }
      setShowNew(false);
      setEditId(null);
      setForm(BLANK);
      load();
    } catch {
      setMutError('Save failed — network error. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this incident?')) return;
    setMutError(null);
    try {
      const res = await fetch(`${ADMIN_BASE}/incidents/${id}`, { method: 'DELETE', headers: adminHeaders() });
      const err = await readMutationError(res, 'en');
      if (err) { setMutError(err); return; }
      load();
    } catch {
      setMutError('Delete failed — network error. Please try again.');
    }
  };

  const openEdit = (inc: Incident) => {
    setMutError(null);
    setEditId(inc.id);
    setForm({ title: inc.title, status: inc.status, severity: inc.severity, description: inc.description || '' });
    setShowNew(true);
  };

  const FIELD_STYLE = {
    width: '100%', height: 36, padding: '0 10px', borderRadius: 7,
    border: '1.5px solid var(--border)', background: 'var(--surface)',
    color: 'var(--text)', fontSize: 13, outline: 'none',
    fontFamily: 'var(--font-sans)', boxSizing: 'border-box' as const,
  };

  const activeIncidents = incidents.filter(i => i.status !== 'resolved');
  const resolvedIncidents = incidents.filter(i => i.status === 'resolved');

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <h1 style={{ fontFamily: 'var(--font-sans)', fontSize: 26, color: 'var(--brand-green)', fontWeight: 700, letterSpacing: '-0.6px' }}>
          Status Incidents
        </h1>
        <button
          onClick={() => { setMutError(null); setShowNew(true); setEditId(null); setForm(BLANK); }}
          style={{ background: 'var(--brand-green)', color: '#fff', border: 'none', borderRadius: 8, padding: '9px 18px', fontSize: 13, fontWeight: 500, cursor: 'pointer', fontFamily: 'var(--font-sans)' }}
        >
          + New Incident
        </button>
      </div>

      {/* U5.1: honest error surface for list-level failures (delete). */}
      {mutError && !showNew && (
        <div role="alert" style={ERR_BANNER}>{mutError}</div>
      )}

      {loading ? (
        <div style={{ color: 'var(--meta)', padding: 32, textAlign: 'center' }}>Loading…</div>
      ) : (
        <>
          {/* Active */}
          {activeIncidents.length > 0 && (
            <div style={{ marginBottom: 24 }}>
              <h2 style={{ fontSize: 13, fontWeight: 700, color: 'var(--danger)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 12 }}>Active</h2>
              {activeIncidents.map(inc => <IncidentCard key={inc.id} inc={inc} onEdit={openEdit} onDelete={handleDelete} />)}
            </div>
          )}

          {/* Resolved history */}
          <div>
            <h2 style={{ fontSize: 13, fontWeight: 700, color: 'var(--meta)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 12 }}>History</h2>
            {resolvedIncidents.length === 0
              ? <p style={{ fontSize: 13, color: 'var(--meta)', fontStyle: 'italic' }}>No resolved incidents.</p>
              : resolvedIncidents.map(inc => <IncidentCard key={inc.id} inc={inc} onEdit={openEdit} onDelete={handleDelete} />)
            }
          </div>
        </>
      )}

      {/* New/Edit Modal */}
      {showNew && (
        <div onClick={() => { setShowNew(false); setEditId(null); }}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', backdropFilter: 'blur(4px)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24, animation: 'overlayIn 0.15s ease-out' }}>
          <div onClick={e => e.stopPropagation()}
            style={{ width: '100%', maxWidth: 480, background: 'var(--panel)', borderRadius: 14, border: '1px solid var(--border)', boxShadow: 'var(--shadow-lg)', overflow: 'hidden', animation: 'modalIn 0.15s ease-out' }}>
            <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--div)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h2 style={{ fontFamily: 'var(--font-sans)', fontSize: 17, color: 'var(--brand-green)', fontWeight: 700 }}>{editId ? 'Edit Incident' : 'New Incident'}</h2>
              <button onClick={() => setShowNew(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--meta)', fontSize: 18 }}>✕</button>
            </div>
            <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 14 }}>
              {mutError && <div role="alert" style={ERR_BANNER}>{mutError}</div>}
              <div>
                <label style={{ fontSize: 'var(--t-caption-fs)', color: 'var(--meta)', display: 'block', marginBottom: 4 }}>Title</label>
                <input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} style={FIELD_STYLE} placeholder="e.g. API latency elevated" />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={{ fontSize: 'var(--t-caption-fs)', color: 'var(--meta)', display: 'block', marginBottom: 4 }}>Status</label>
                  <select value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))} style={{ ...FIELD_STYLE, cursor: 'pointer' }}>
                    {STATUS_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
                <div>
                  <label style={{ fontSize: 'var(--t-caption-fs)', color: 'var(--meta)', display: 'block', marginBottom: 4 }}>Severity</label>
                  <select value={form.severity} onChange={e => setForm(f => ({ ...f, severity: e.target.value }))} style={{ ...FIELD_STYLE, cursor: 'pointer' }}>
                    {SEVERITY_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label style={{ fontSize: 'var(--t-caption-fs)', color: 'var(--meta)', display: 'block', marginBottom: 4 }}>Description</label>
                <textarea
                  value={form.description}
                  onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                  rows={4}
                  style={{ ...FIELD_STYLE, height: 'auto', padding: '8px 10px', resize: 'vertical' }}
                  placeholder="Details about the incident…"
                />
              </div>
              <button onClick={handleSave} disabled={saving || !form.title.trim()}
                style={{ background: 'var(--brand-green)', color: '#fff', border: 'none', borderRadius: 8, padding: '10px', fontSize: 13, fontWeight: 600, cursor: saving ? 'not-allowed' : 'pointer', fontFamily: 'var(--font-sans)', opacity: saving || !form.title.trim() ? 0.6 : 1 }}>
                {saving ? 'Saving…' : editId ? 'Update Incident' : 'Create Incident'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function IncidentCard({ inc, onEdit, onDelete }: { inc: Incident; onEdit: (i: Incident) => void; onDelete: (id: string) => void }) {
  return (
    <div style={{ background: 'var(--panel)', border: '1px solid var(--border)', borderRadius: 12, padding: '16px 20px', marginBottom: 10 }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
            <span style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: STATUS_COLOR[inc.status] || 'var(--meta)' }}>
              {inc.status}
            </span>
            <span style={{ fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', color: '#fff', background: SEVERITY_COLOR[inc.severity] || '#666', padding: '1px 6px', borderRadius: 3 }}>
              {inc.severity}
            </span>
          </div>
          <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--text)', fontFamily: 'var(--font-sans)', marginBottom: inc.description ? 6 : 0 }}>
            {inc.title}
          </div>
          {inc.description && (
            <div style={{ fontSize: 13, color: 'var(--meta)', lineHeight: 1.5 }}>{inc.description}</div>
          )}
          <div style={{ fontSize: 11, color: 'var(--text-faint)', marginTop: 8 }}>
            {new Date(inc.created_at).toLocaleString()}
            {inc.resolved_at && ` · Resolved ${new Date(inc.resolved_at).toLocaleString()}`}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
          <button onClick={() => onEdit(inc)}
            style={{ background: 'transparent', border: '1px solid var(--border)', borderRadius: 6, padding: '4px 10px', fontSize: 'var(--t-caption-fs)', cursor: 'pointer', color: 'var(--text)', fontFamily: 'var(--font-sans)' }}>
            Edit
          </button>
          <button onClick={() => onDelete(inc.id)}
            style={{ background: 'transparent', border: '1px solid var(--danger)', borderRadius: 6, padding: '4px 10px', fontSize: 'var(--t-caption-fs)', cursor: 'pointer', color: 'var(--danger)', fontFamily: 'var(--font-sans)' }}>
            Delete
          </button>
        </div>
      </div>
    </div>
  );
}
