'use client';

import { useEffect, useState, useCallback } from 'react';

const ADMIN_BASE = '/api/admin';
const adminHeaders = () => ({ 'Content-Type': 'application/json' });

interface Model {
  id: string;
  name: string;
  slug: string;
  provider: string;
  layer: string;
  description: string | null;
  tags: string[];
  requires_key: boolean;
  available: boolean;
  phase: number;
}

const BLANK: Omit<Model, 'id'> = {
  name: '', slug: '', provider: '', layer: 'byok',
  description: '', tags: [], requires_key: false, available: true, phase: 1,
};

const LAYER_COLORS: Record<string, string> = {
  byok: 'var(--brand-green)', free_api: '#1a2d5a', goblin_hosted: '#7A4A8A',
};

export default function AdminModelsPage() {
  const [models, setModels] = useState<Model[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState<Omit<Model, 'id'>>(BLANK);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch(`${ADMIN_BASE}/models`, { headers: adminHeaders() });
    if (res.ok) setModels(await res.json());
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const toggleAvailable = async (m: Model) => {
    await fetch(`${ADMIN_BASE}/models/${m.id}`, {
      method: 'PATCH', headers: adminHeaders(),
      body: JSON.stringify({ available: !m.available }),
    });
    setModels(prev => prev.map(x => x.id === m.id ? { ...x, available: !x.available } : x));
  };

  const handleSave = async () => {
    setSaving(true);
    const payload = { ...form, tags: Array.isArray(form.tags) ? form.tags : [] };
    if (editId) {
      await fetch(`${ADMIN_BASE}/models/${editId}`, {
        method: 'PATCH', headers: adminHeaders(), body: JSON.stringify(payload),
      });
    } else {
      await fetch(`${ADMIN_BASE}/models`, {
        method: 'POST', headers: adminHeaders(), body: JSON.stringify(payload),
      });
    }
    setSaving(false);
    setShowAdd(false);
    setEditId(null);
    setForm(BLANK);
    load();
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this model?')) return;
    await fetch(`${ADMIN_BASE}/models/${id}`, { method: 'DELETE', headers: adminHeaders() });
    load();
  };

  const openEdit = (m: Model) => {
    setEditId(m.id);
    setForm({ name: m.name, slug: m.slug, provider: m.provider, layer: m.layer, description: m.description, tags: m.tags, requires_key: m.requires_key, available: m.available, phase: m.phase });
    setShowAdd(true);
  };

  const FIELD_STYLE = {
    width: '100%', height: 36, padding: '0 10px', borderRadius: 7,
    border: '1.5px solid var(--border)', background: 'var(--surface)',
    color: 'var(--text)', fontSize: 13, outline: 'none',
    fontFamily: 'var(--font-sans)', boxSizing: 'border-box' as const,
  };

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <h1 style={{ fontFamily: 'var(--font-sans)', fontSize: 26, color: 'var(--brand-green)', fontWeight: 700, letterSpacing: '-0.6px' }}>
          Models
        </h1>
        <button
          onClick={() => { setShowAdd(true); setEditId(null); setForm(BLANK); }}
          style={{ background: 'var(--brand-green)', color: '#fff', border: 'none', borderRadius: 8, padding: '9px 18px', fontSize: 13, fontWeight: 500, cursor: 'pointer', fontFamily: 'var(--font-sans)' }}
        >
          + Add Model
        </button>
      </div>

      <div style={{ background: 'var(--panel)', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden' }}>
        {loading ? (
          <div style={{ padding: '32px', textAlign: 'center', color: 'var(--meta)' }}>Loading…</div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, fontFamily: 'var(--font-sans)' }}>
            <thead>
              <tr style={{ borderBottom: '2px solid var(--div)' }}>
                {['Name', 'Provider', 'Layer', 'Phase', 'Available', 'Actions'].map(h => (
                  <th key={h} style={{ textAlign: 'left', padding: '10px 14px', color: 'var(--meta)', fontWeight: 600, fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {models.map(m => (
                <tr key={m.id} style={{ borderBottom: '1px solid var(--div)' }}>
                  <td style={{ padding: '10px 14px', color: 'var(--text)', fontWeight: 500 }}>
                    {m.name}
                    {m.description && <div style={{ fontSize: 11, color: 'var(--meta)', marginTop: 2 }}>{m.description}</div>}
                  </td>
                  <td style={{ padding: '10px 14px', color: 'var(--meta)' }}>{m.provider}</td>
                  <td style={{ padding: '10px 14px' }}>
                    <span style={{ fontSize: 11, fontWeight: 700, background: LAYER_COLORS[m.layer] || '#666', color: '#fff', padding: '2px 7px', borderRadius: 4, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                      {m.layer}
                    </span>
                  </td>
                  <td style={{ padding: '10px 14px', color: 'var(--meta)' }}>Phase {m.phase}</td>
                  <td style={{ padding: '10px 14px' }}>
                    <button
                      onClick={() => toggleAvailable(m)}
                      style={{
                        background: m.available ? 'rgba(74,124,59,0.12)' : 'rgba(184,92,60,0.12)',
                        color: m.available ? 'var(--success)' : 'var(--danger)',
                        border: 'none', borderRadius: 20, padding: '3px 10px', fontSize: 'var(--t-caption-fs)',
                        cursor: 'pointer', fontWeight: 600, fontFamily: 'var(--font-sans)',
                      }}
                    >
                      {m.available ? '✓ On' : '✗ Off'}
                    </button>
                  </td>
                  <td style={{ padding: '10px 14px' }}>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button onClick={() => openEdit(m)}
                        style={{ background: 'transparent', border: '1px solid var(--border)', borderRadius: 6, padding: '4px 10px', fontSize: 'var(--t-caption-fs)', cursor: 'pointer', color: 'var(--text)', fontFamily: 'var(--font-sans)' }}>
                        Edit
                      </button>
                      <button onClick={() => handleDelete(m.id)}
                        style={{ background: 'transparent', border: '1px solid var(--danger)', borderRadius: 6, padding: '4px 10px', fontSize: 'var(--t-caption-fs)', cursor: 'pointer', color: 'var(--danger)', fontFamily: 'var(--font-sans)' }}>
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Add/Edit Modal */}
      {showAdd && (
        <div
          onClick={() => { setShowAdd(false); setEditId(null); }}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', backdropFilter: 'blur(4px)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24, animation: 'overlayIn 0.15s ease-out' }}
        >
          <div onClick={e => e.stopPropagation()} style={{ width: '100%', maxWidth: 480, background: 'var(--panel)', borderRadius: 14, border: '1px solid var(--border)', boxShadow: 'var(--shadow-lg)', overflow: 'hidden', animation: 'modalIn 0.15s ease-out' }}>
            <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--div)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h2 style={{ fontFamily: 'var(--font-sans)', fontSize: 17, color: 'var(--brand-green)', fontWeight: 700 }}>{editId ? 'Edit Model' : 'Add Model'}</h2>
              <button onClick={() => setShowAdd(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--meta)', fontSize: 18 }}>✕</button>
            </div>
            <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 12 }}>
              {[
                { key: 'name', label: 'Name' },
                { key: 'slug', label: 'Slug' },
                { key: 'provider', label: 'Provider' },
                { key: 'description', label: 'Description' },
              ].map(({ key, label }) => (
                <div key={key}>
                  <label style={{ fontSize: 'var(--t-caption-fs)', color: 'var(--meta)', display: 'block', marginBottom: 4 }}>{label}</label>
                  <input value={(form as Record<string, unknown>)[key] as string || ''} onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))} style={FIELD_STYLE} />
                </div>
              ))}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={{ fontSize: 'var(--t-caption-fs)', color: 'var(--meta)', display: 'block', marginBottom: 4 }}>Layer</label>
                  <select value={form.layer} onChange={e => setForm(f => ({ ...f, layer: e.target.value }))} style={{ ...FIELD_STYLE, cursor: 'pointer' }}>
                    {['byok', 'free_api', 'goblin_hosted'].map(l => <option key={l} value={l}>{l}</option>)}
                  </select>
                </div>
                <div>
                  <label style={{ fontSize: 'var(--t-caption-fs)', color: 'var(--meta)', display: 'block', marginBottom: 4 }}>Phase</label>
                  <input type="number" value={form.phase} onChange={e => setForm(f => ({ ...f, phase: Number(e.target.value) }))} style={FIELD_STYLE} />
                </div>
              </div>
              <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
                {[
                  { key: 'requires_key', label: 'Requires Key' },
                  { key: 'available', label: 'Available' },
                ].map(({ key, label }) => (
                  <label key={key} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: 'var(--text)', cursor: 'pointer' }}>
                    <input type="checkbox" checked={(form as Record<string, unknown>)[key] as boolean} onChange={e => setForm(f => ({ ...f, [key]: e.target.checked }))} />
                    {label}
                  </label>
                ))}
              </div>
              <button
                onClick={handleSave}
                disabled={saving}
                style={{ background: 'var(--brand-green)', color: '#fff', border: 'none', borderRadius: 8, padding: '10px', fontSize: 13, fontWeight: 600, cursor: saving ? 'not-allowed' : 'pointer', fontFamily: 'var(--font-sans)', marginTop: 8 }}
              >
                {saving ? 'Saving…' : editId ? 'Save Changes' : 'Add Model'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
