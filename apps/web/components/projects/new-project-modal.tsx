'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { INTENTS, setStoredIntent, type Intent } from '@/lib/intent';

const COLORS = [
  { name: 'Gold',   hex: '#D4A737' },
  { name: 'Green',  hex: '#1A3A2A' },
  { name: 'Rust',   hex: '#B85C3C' },
  { name: 'Slate',  hex: '#3A2E1F' },
  { name: 'Purple', hex: '#7A4A8A' },
  { name: 'Teal',   hex: '#4A7A7A' },
  { name: 'Pink',   hex: '#8A3A5A' },
];

const CATEGORIES = ['all', 'saas', 'landing', 'api', 'tool', 'blog', 'ecommerce'];

const STACK_COLORS: Record<string, string> = {
  nextjs: '#000', tailwind: '#0ea5e9', supabase: '#3ecf8e',
  stripe: '#635bff', hono: '#e36002', typescript: '#3178c6',
  openai: '#412991', recharts: '#8884d8', mdx: '#fcb32c',
  resend: '#000', react: '#61dafb',
};

interface Template {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  category: string;
  tags: string[];
  thumbnail_url: string | null;
  is_official: boolean;
  downloads: number;
  tech_stack: string[];
}

interface NewProjectModalProps {
  onClose: () => void;
  initialMode?: 'blank' | 'template';
  /** Pre-fill the "What are you building?" field — e.g. the prompt the user
      typed into the dashboard "Sag Goblin" composer (B-S3). */
  initialIdea?: string;
}

type Mode = 'blank' | 'gallery' | 'template-detail' | 'template-name';

export function NewProjectModal({ onClose, initialMode, initialIdea }: NewProjectModalProps) {
  const router = useRouter();
  const supabase = createClient();

  const [mode, setMode] = useState<Mode>(initialMode === 'template' ? 'gallery' : 'blank');
  const [name, setName] = useState('');
  const [description, setDescription] = useState(initialIdea?.slice(0, 200) ?? '');
  const [intent, setIntent] = useState<Intent>('exploring');
  const [selectedColor, setSelectedColor] = useState(COLORS[0]?.hex ?? '#D4A737');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Template gallery state
  const [templates, setTemplates] = useState<Template[]>([]);
  const [templatesLoading, setTemplatesLoading] = useState(false);
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [selectedTemplate, setSelectedTemplate] = useState<Template | null>(null);
  const [templateName, setTemplateName] = useState('');

  const apiBase = process.env.NEXT_PUBLIC_API_URL || '';

  useEffect(() => {
    if (mode === 'gallery' && templates.length === 0) {
      setTemplatesLoading(true);
      const params = categoryFilter !== 'all' ? `?category=${categoryFilter}` : '';
      fetch(`${apiBase}/api/templates${params}`)
        .then(r => r.ok ? r.json() : [])
        .then(data => setTemplates(Array.isArray(data) ? data : []))
        .catch(() => setTemplates([]))
        .finally(() => setTemplatesLoading(false));
    }
  }, [mode, apiBase, templates.length]);

  useEffect(() => {
    if (mode === 'gallery') {
      setTemplatesLoading(true);
      const params = categoryFilter !== 'all' ? `?category=${categoryFilter}` : '';
      fetch(`${apiBase}/api/templates${params}`)
        .then(r => r.ok ? r.json() : [])
        .then(data => setTemplates(Array.isArray(data) ? data : []))
        .catch(() => setTemplates([]))
        .finally(() => setTemplatesLoading(false));
    }
  }, [categoryFilter, mode, apiBase]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (mode === 'template-name') { setMode('template-detail'); }
        else if (mode === 'template-detail') { setMode('gallery'); setSelectedTemplate(null); }
        else { onClose(); }
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose, mode]);

  const handleBlankSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      if (!token) throw new Error('Not authenticated');

      const res = await fetch(`${apiBase}/api/projects`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ name: name.trim(), description: description.trim() || undefined, color: selectedColor, intent }),
      });
      if (!res.ok) throw new Error((await res.json()).error || 'Failed to create project');
      const project = await res.json();
      // Local hint so the Code-Tab foreground is correct immediately, even if the
      // DB has no `intent` column yet (migration 0057 may be unapplied). DB wins later.
      if (project?.id) setStoredIntent(project.id, intent);
      onClose();
      router.push(`/dashboard/project/${project.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create project');
    } finally {
      setLoading(false);
    }
  };

  const handleTemplateCreate = async () => {
    if (!selectedTemplate || !templateName.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      if (!token) throw new Error('Not authenticated');

      const res = await fetch(`${apiBase}/api/projects/from-template`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ templateId: selectedTemplate.id, projectName: templateName.trim(), description: selectedTemplate.description }),
      });
      if (!res.ok) throw new Error((await res.json()).error || 'Failed to create project');
      const project = await res.json();
      onClose();
      router.push(`/dashboard/project/${project.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create project');
    } finally {
      setLoading(false);
    }
  };

  const MODAL_WIDTH = mode === 'gallery' || mode === 'template-detail' ? 680 : 440;

  return (
    <>
      <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', backdropFilter: 'blur(4px)', zIndex: 200, animation: 'overlayIn 0.15s ease-out' }} onClick={onClose} />

      <div style={{
        position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%,-50%)',
        background: 'var(--panel)', borderRadius: 16, padding: 0,
        width: `min(${MODAL_WIDTH}px, calc(100vw - 32px))`,
        maxHeight: 'calc(100dvh - 48px)',
        zIndex: 201, boxShadow: 'var(--shadow-lg)',
        display: 'flex', flexDirection: 'column',
        overflow: 'hidden',
        animation: 'modalIn 0.15s ease-out',
        transition: 'width 0.2s ease',
      }}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '20px 24px', borderBottom: '1px solid var(--div)', flexShrink: 0 }}>
          <div style={{ display: 'flex', gap: 4, background: 'var(--subtle)', borderRadius: 9, padding: 4 }}>
            <ModeTab label="Blank Project" active={mode === 'blank'} onClick={() => setMode('blank')} />
            <ModeTab label="From Template" active={mode !== 'blank'} onClick={() => setMode('gallery')} />
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 18, color: 'var(--meta)', padding: 4 }}>✕</button>
        </div>

        {/* Body */}
        <div style={{ flex: 1, overflow: 'auto' }}>

          {/* ─── Mode: Blank ─── */}
          {mode === 'blank' && (
            <form onSubmit={handleBlankSubmit} style={{ padding: '20px 24px 24px' }}>
              <div style={{ marginBottom: 16 }}>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: 'var(--text)', marginBottom: 6 }}>Project Name</label>
                <input
                  type="text" value={name} onChange={e => setName(e.target.value.slice(0, 50))}
                  placeholder="My Awesome Project" required maxLength={50} autoFocus
                  data-testid="project-name-input"
                  style={{ width: '100%', padding: '10px 14px', borderRadius: 8, border: '1px solid var(--border)', fontSize: 'var(--t-small-fs)', fontFamily: 'var(--font-sans)', outline: 'none', background: 'var(--surface)', color: 'var(--text)', boxSizing: 'border-box' }}
                  onFocus={e => (e.target.style.borderColor = 'var(--brand-green)')}
                  onBlur={e => (e.target.style.borderColor = 'var(--border)')}
                />
                <div style={{ fontSize: 11, color: 'var(--meta)', marginTop: 4, textAlign: 'right' }}>{name.length}/50</div>
              </div>

              <div style={{ marginBottom: 16 }}>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: 'var(--text)', marginBottom: 6 }}>What are you building?</label>
                <textarea
                  value={description} onChange={e => setDescription(e.target.value.slice(0, 200))}
                  rows={3} placeholder="Optional — describe your project idea..." maxLength={200}
                  style={{ width: '100%', padding: '10px 14px', borderRadius: 8, border: '1px solid var(--border)', fontSize: 'var(--t-small-fs)', resize: 'none', fontFamily: 'var(--font-sans)', outline: 'none', background: 'var(--surface)', color: 'var(--text)', boxSizing: 'border-box' }}
                  onFocus={e => (e.target.style.borderColor = 'var(--brand-green)')}
                  onBlur={e => (e.target.style.borderColor = 'var(--border)')}
                />
                <div style={{ fontSize: 11, color: 'var(--meta)', marginTop: 4, textAlign: 'right' }}>{description.length}/200</div>
              </div>

              {/* Intent — sets the Code-Tab default foreground (not a mode). Default
                  "exploring" is pre-selected, so Max never has to touch this. */}
              <div style={{ marginBottom: 20 }}>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: 'var(--text)', marginBottom: 10 }}>Was baust du?</label>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8 }}>
                  {INTENTS.map(opt => {
                    const active = intent === opt.id;
                    const I = opt.icon;
                    return (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => setIntent(opt.id)}
                        aria-pressed={active}
                        data-testid={`intent-${opt.id}`}
                        style={{
                          position: 'relative', textAlign: 'left', display: 'flex', flexDirection: 'column', gap: 4,
                          padding: '11px 12px', borderRadius: 10, cursor: 'pointer',
                          border: active ? '2px solid var(--brand-green)' : '1.5px solid var(--border)',
                          background: active ? 'rgba(45,74,43,0.06)' : 'var(--surface)',
                          transition: 'border-color 0.12s, background 0.12s',
                          fontFamily: 'var(--font-sans)',
                        }}
                      >
                        <span style={{ display: 'flex', alignItems: 'center', gap: 7, color: active ? 'var(--brand-green)' : 'var(--text)' }}>
                          <I size={17} weight={active ? 'fill' : 'regular'} />
                          <span style={{ fontSize: 12.5, fontWeight: 600, lineHeight: 1.15 }}>{opt.label}</span>
                        </span>
                        <span style={{ fontSize: 11, color: 'var(--meta)', lineHeight: 1.35 }}>{opt.sub}</span>
                        {opt.comingSoon && (
                          <span style={{ position: 'absolute', top: 8, right: 8, fontSize: 9, fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase', color: 'var(--brand-gold)', background: 'rgba(212,167,55,0.14)', padding: '1px 5px', borderRadius: 4 }} title="Import-Feature kommt Sprint 11">Bald</span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div style={{ marginBottom: 24 }}>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: 'var(--text)', marginBottom: 10 }}>Color</label>
                <div style={{ display: 'flex', gap: 10 }}>
                  {COLORS.map(c => (
                    <button key={c.hex} type="button" onClick={() => setSelectedColor(c.hex)} title={c.name}
                      style={{ width: 32, height: 32, borderRadius: '50%', background: c.hex, border: selectedColor === c.hex ? '3px solid var(--brand-green)' : '3px solid transparent', cursor: 'pointer', transition: 'all 0.15s', transform: selectedColor === c.hex ? 'scale(1.15)' : 'scale(1)' }}
                    />
                  ))}
                </div>
              </div>

              {error && <div style={{ padding: '10px 14px', borderRadius: 8, background: 'rgba(184,92,60,0.1)', color: 'var(--danger)', fontSize: 13, marginBottom: 16 }}>{error}</div>}

              <button type="submit" disabled={!name.trim() || loading}
                data-testid="project-create-submit"
                style={{ width: '100%', padding: '12px 20px', borderRadius: 10, background: 'var(--brand-green)', color: 'var(--brand-gold)', border: 'none', fontSize: 15, fontWeight: 600, cursor: loading ? 'wait' : 'pointer', fontFamily: 'var(--font-sans)', opacity: !name.trim() ? 0.5 : 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                {loading ? <Spinner /> : 'Create project →'}
              </button>
            </form>
          )}

          {/* ─── Mode: Gallery ─── */}
          {mode === 'gallery' && (
            <div style={{ padding: '16px 24px 24px' }}>
              {/* Category filter */}
              <div style={{ display: 'flex', gap: 6, marginBottom: 16, overflowX: 'auto', paddingBottom: 4 }}>
                {CATEGORIES.map(cat => (
                  <button key={cat} onClick={() => setCategoryFilter(cat)}
                    style={{ padding: '5px 14px', borderRadius: 20, fontSize: 'var(--t-caption-fs)', fontWeight: 500, border: categoryFilter === cat ? '2px solid var(--brand-green)' : '1.5px solid var(--border)', background: categoryFilter === cat ? 'rgba(45,74,43,0.08)' : 'transparent', color: categoryFilter === cat ? 'var(--brand-green)' : 'var(--meta)', cursor: 'pointer', flexShrink: 0, fontFamily: 'var(--font-sans)', textTransform: 'capitalize' }}>
                    {cat}
                  </button>
                ))}
              </div>

              {templatesLoading ? (
                <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--meta)' }}>Loading templates…</div>
              ) : templates.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--meta)' }}>No templates yet.</div>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12 }}>
                  {templates.map(t => (
                    <TemplateCard key={t.id} template={t} onSelect={() => { setSelectedTemplate(t); setMode('template-detail'); }} />
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ─── Mode: Template Detail ─── */}
          {mode === 'template-detail' && selectedTemplate && (
            <div style={{ padding: '20px 24px 24px' }}>
              <button onClick={() => { setMode('gallery'); setSelectedTemplate(null); }}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--meta)', fontSize: 13, display: 'flex', alignItems: 'center', gap: 4, marginBottom: 16, padding: 0 }}>
                ← Back to gallery
              </button>

              {/* Thumbnail placeholder */}
              <div style={{ background: templateGradient(selectedTemplate.category), borderRadius: 10, height: 140, marginBottom: 20, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <span style={{ fontSize: 48 }}>{categoryIcon(selectedTemplate.category)}</span>
              </div>

              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, marginBottom: 12 }}>
                <div style={{ flex: 1 }}>
                  <h2 style={{ fontFamily: 'var(--font-sans)', fontSize: 20, fontWeight: 700, color: 'var(--brand-green)', letterSpacing: '-0.3px', margin: 0, marginBottom: 4 }}>{selectedTemplate.name}</h2>
                  {selectedTemplate.is_official && (
                    <span style={{ fontSize: 11, background: 'rgba(45,74,43,0.1)', color: 'var(--brand-green)', padding: '2px 8px', borderRadius: 4, fontWeight: 700 }}>✓ Official</span>
                  )}
                </div>
                <span style={{ fontSize: 'var(--t-caption-fs)', color: 'var(--meta)' }}>↓ {selectedTemplate.downloads}</span>
              </div>

              {selectedTemplate.description && (
                <p style={{ fontSize: 'var(--t-small-fs)', color: 'var(--text-2)', lineHeight: 1.6, marginBottom: 16 }}>{selectedTemplate.description}</p>
              )}

              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 20 }}>
                {selectedTemplate.tech_stack.map(s => (
                  <span key={s} style={{ fontSize: 11, fontWeight: 600, padding: '3px 8px', borderRadius: 4, background: 'rgba(0,0,0,0.06)', color: 'var(--text)', border: '1px solid var(--border)' }}>{s}</span>
                ))}
              </div>

              {error && <div style={{ padding: '10px 14px', borderRadius: 8, background: 'rgba(184,92,60,0.1)', color: 'var(--danger)', fontSize: 13, marginBottom: 16 }}>{error}</div>}

              <button onClick={() => { setTemplateName(selectedTemplate.name); setMode('template-name'); }}
                style={{ width: '100%', padding: '12px 20px', borderRadius: 10, background: 'var(--brand-gold)', color: '#fff', border: 'none', fontSize: 15, fontWeight: 600, cursor: 'pointer', fontFamily: 'var(--font-sans)' }}>
                Start with this template →
              </button>
            </div>
          )}

          {/* ─── Mode: Template Name Input ─── */}
          {mode === 'template-name' && selectedTemplate && (
            <div style={{ padding: '20px 24px 24px' }}>
              <button onClick={() => setMode('template-detail')}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--meta)', fontSize: 13, display: 'flex', alignItems: 'center', gap: 4, marginBottom: 20, padding: 0 }}>
                ← {selectedTemplate.name}
              </button>

              <h2 style={{ fontFamily: 'var(--font-sans)', fontSize: 20, fontWeight: 700, color: 'var(--brand-green)', marginBottom: 4 }}>Name your project</h2>
              <p style={{ fontSize: 13, color: 'var(--meta)', marginBottom: 20 }}>Starting from: {selectedTemplate.name}</p>

              <div style={{ marginBottom: 20 }}>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: 'var(--text)', marginBottom: 6 }}>Project Name</label>
                <input
                  type="text" value={templateName} onChange={e => setTemplateName(e.target.value.slice(0, 50))}
                  placeholder={selectedTemplate.name} maxLength={50} autoFocus
                  style={{ width: '100%', padding: '10px 14px', borderRadius: 8, border: '1px solid var(--border)', fontSize: 'var(--t-small-fs)', fontFamily: 'var(--font-sans)', outline: 'none', background: 'var(--surface)', color: 'var(--text)', boxSizing: 'border-box' }}
                  onFocus={e => (e.target.style.borderColor = 'var(--brand-green)')}
                  onBlur={e => (e.target.style.borderColor = 'var(--border)')}
                  onKeyDown={e => { if (e.key === 'Enter' && templateName.trim()) handleTemplateCreate(); }}
                />
              </div>

              {error && <div style={{ padding: '10px 14px', borderRadius: 8, background: 'rgba(184,92,60,0.1)', color: 'var(--danger)', fontSize: 13, marginBottom: 16 }}>{error}</div>}

              <button onClick={handleTemplateCreate} disabled={!templateName.trim() || loading}
                style={{ width: '100%', padding: '12px 20px', borderRadius: 10, background: 'var(--brand-green)', color: 'var(--brand-gold)', border: 'none', fontSize: 15, fontWeight: 600, cursor: loading ? 'wait' : 'pointer', fontFamily: 'var(--font-sans)', opacity: !templateName.trim() ? 0.5 : 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                {loading ? <Spinner /> : 'Create project →'}
              </button>
            </div>
          )}
        </div>
      </div>
    </>
  );
}

function ModeTab({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick}
      style={{ padding: '6px 14px', borderRadius: 6, fontSize: 13, fontWeight: 500, border: 'none', cursor: 'pointer', background: active ? 'var(--panel)' : 'transparent', color: active ? 'var(--brand-green)' : 'var(--meta)', fontFamily: 'var(--font-sans)', boxShadow: active ? 'var(--shadow-sm)' : 'none', transition: 'all 0.1s' }}>
      {label}
    </button>
  );
}

function TemplateCard({ template, onSelect }: { template: Template; onSelect: () => void }) {
  const [hovered, setHovered] = useState(false);
  return (
    <div
      onClick={onSelect}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{ borderRadius: 10, border: '1px solid var(--border)', overflow: 'hidden', cursor: 'pointer', transition: 'all 0.15s', transform: hovered ? 'translateY(-2px)' : 'none', boxShadow: hovered ? 'var(--shadow-md)' : 'none', background: 'var(--panel)' }}>
      {/* Thumbnail */}
      <div style={{ height: 80, background: templateGradient(template.category), display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative' }}>
        <span style={{ fontSize: 32 }}>{categoryIcon(template.category)}</span>
        {template.is_official && (
          <span style={{ position: 'absolute', top: 6, right: 6, fontSize: 10, fontWeight: 700, background: 'var(--brand-green)', color: '#fff', padding: '2px 6px', borderRadius: 4 }}>Official</span>
        )}
        {hovered && (
          <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.35)', display: 'flex', alignItems: 'center', justifyContent: 'center', animation: 'fadeIn 0.1s ease' }}>
            <span style={{ color: '#fff', fontSize: 13, fontWeight: 600, fontFamily: 'var(--font-sans)' }}>Use Template →</span>
          </div>
        )}
      </div>
      {/* Info */}
      <div style={{ padding: '10px 12px' }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', marginBottom: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{template.name}</div>
        {template.description && (
          <div style={{ fontSize: 11, color: 'var(--meta)', lineHeight: 1.4, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden', marginBottom: 6 }}>{template.description}</div>
        )}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
          {template.tech_stack.slice(0, 3).map(s => (
            <span key={s} style={{ fontSize: 10, fontWeight: 600, padding: '1px 5px', borderRadius: 3, background: `${STACK_COLORS[s] || '#666'}18`, color: STACK_COLORS[s] || 'var(--meta)', border: `1px solid ${STACK_COLORS[s] || '#666'}30` }}>{s}</span>
          ))}
        </div>
      </div>
    </div>
  );
}

function Spinner() {
  return <span style={{ display: 'inline-block', width: 16, height: 16, border: '2px solid currentColor', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.6s linear infinite' }} />;
}

function templateGradient(category: string): string {
  const gradients: Record<string, string> = {
    saas:      'linear-gradient(135deg, #1A3A2A 0%, #3D7A4F 100%)',
    landing:   'linear-gradient(135deg, #D4A737 0%, #E8C97F 100%)',
    api:       'linear-gradient(135deg, #1a2d5a 0%, #3A6B8A 100%)',
    tool:      'linear-gradient(135deg, #7A4A8A 0%, #9A6AAA 100%)',
    blog:      'linear-gradient(135deg, #B85C3C 0%, #D4794A 100%)',
    ecommerce: 'linear-gradient(135deg, #3A6B8A 0%, #5A9BAA 100%)',
  };
  return gradients[category] || 'linear-gradient(135deg, #3A2E1F 0%, #6B6B6B 100%)';
}

function categoryIcon(category: string): string {
  const icons: Record<string, string> = {
    saas: '🚀', landing: '🌟', api: '⚡', tool: '🛠️', blog: '✍️', ecommerce: '🛍️',
  };
  return icons[category] || '📦';
}
