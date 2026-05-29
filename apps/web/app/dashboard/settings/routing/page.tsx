'use client';
// LEGACY — superseded by SettingsRoot + SettingsModal. Direct-URL
// access only. Do not extend; future settings additions belong in
// SettingsRoot (apps/web/components/settings/SettingsRoot.tsx)
// and components/settings/sections.ts.
import { useEffect, useState, useCallback } from 'react';
import {
  DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove, SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy, useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { SettingsLayout } from '@/components/settings/settings-layout';
import { apiGet } from '@/lib/api';
import { getAuthHeaders, API_URL } from '@/lib/api';

interface ChainStep {
  id: string;
  type: 'provider' | 'block';
  label: string;
  provider?: string;
  model?: string;
  tier?: string;
}

const PROVIDER_OPTIONS: Array<{ provider: string; label: string; tier: string; model: string }> = [
  { provider: 'anthropic', label: 'Anthropic (BYOK)', tier: 'byok', model: 'claude-sonnet-4-6' },
  { provider: 'openai',    label: 'OpenAI (BYOK)',    tier: 'byok', model: 'gpt-4o' },
  { provider: 'google',    label: 'Google (BYOK)',    tier: 'byok', model: 'gemini-2.0-flash' },
  { provider: 'groq',      label: 'Groq (BYOK)',      tier: 'byok', model: 'llama-3.3-70b-versatile' },
  { provider: 'deepseek',  label: 'DeepSeek (BYOK)',  tier: 'byok', model: 'deepseek-chat' },
  { provider: 'gemini-free', label: 'Gemini Flash (Free)', tier: 'free_api', model: 'gemini-2.0-flash' },
  { provider: 'groq-free', label: 'Groq Llama (Free)', tier: 'free_api', model: 'llama-3.3-70b-versatile' },
];

function makeId() {
  return Math.random().toString(36).slice(2, 10);
}

function SortableStep({ step, onRemove }: { step: ChainStep; onRemove: (id: string) => void }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: step.id });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    background: '#fff',
    border: `1px solid ${step.type === 'block' ? 'rgba(184,92,60,0.3)' : 'var(--div)'}`,
    borderRadius: 9,
    padding: '10px 12px',
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    cursor: isDragging ? 'grabbing' : 'grab',
    userSelect: 'none',
  };

  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners}>
      {/* Drag handle */}
      <svg width="14" height="14" viewBox="0 0 16 16" fill="#C0BAB0" style={{ flexShrink: 0 }}>
        <circle cx="5" cy="4" r="1.5" /><circle cx="11" cy="4" r="1.5" />
        <circle cx="5" cy="8" r="1.5" /><circle cx="11" cy="8" r="1.5" />
        <circle cx="5" cy="12" r="1.5" /><circle cx="11" cy="12" r="1.5" />
      </svg>

      <div style={{ flex: 1, minWidth: 0 }}>
        <span style={{
          fontSize: 13, fontWeight: 600,
          color: step.type === 'block' ? 'var(--danger)' : 'var(--text)',
          fontFamily: 'var(--font-sans)',
        }}>
          {step.label}
        </span>
        {step.tier && (
          <span style={{
            marginLeft: 8, fontSize: 10, fontWeight: 600,
            padding: '1px 6px', borderRadius: 4,
            background: step.tier === 'byok' ? 'rgba(45,74,43,0.1)' : 'rgba(212,169,74,0.15)',
            color: step.tier === 'byok' ? 'var(--brand-green)' : '#b88a20',
            fontFamily: 'var(--font-sans)', textTransform: 'uppercase', letterSpacing: '0.3px',
          }}>
            {step.tier === 'byok' ? 'BYOK' : step.tier === 'free_api' ? 'Free' : 'Hosted'}
          </span>
        )}
      </div>

      <button
        onClick={(e) => { e.stopPropagation(); onRemove(step.id); }}
        style={{
          flexShrink: 0, width: 22, height: 22,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: 'none', border: 'none', borderRadius: 5,
          color: '#C0BAB0', cursor: 'pointer', fontSize: 14,
        }}
        onMouseEnter={e => (e.currentTarget.style.color = 'var(--danger)')}
        onMouseLeave={e => (e.currentTarget.style.color = '#C0BAB0')}
      >
        ×
      </button>
    </div>
  );
}

export default function RoutingSettingsPage() {
  const [steps, setSteps] = useState<ChainStep[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [addingProvider, setAddingProvider] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  useEffect(() => {
    apiGet<{ chain: string[] }>('/api/users/me/fallback-chain')
      .then(({ chain }) => {
        setSteps(chain.map((slug): ChainStep => {
          if (slug === '__block__') {
            return { id: makeId(), type: 'block', label: 'Block (stop here)' };
          }
          const opt = PROVIDER_OPTIONS.find(o => o.provider === slug);
          return {
            id: makeId(),
            type: 'provider',
            label: opt?.label ?? slug,
            provider: slug,
            tier: opt?.tier,
          };
        }));
      })
      .catch(() => {
        // Default chain for new users
        setSteps([
          { id: makeId(), type: 'provider', label: 'Anthropic (BYOK)', provider: 'anthropic', tier: 'byok' },
          { id: makeId(), type: 'provider', label: 'Gemini Flash (Free)', provider: 'gemini-free', tier: 'free_api' },
          { id: makeId(), type: 'block', label: 'Block (stop here)' },
        ]);
      })
      .finally(() => setLoading(false));
  }, []);

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      setSteps(prev => {
        const oldIdx = prev.findIndex(s => s.id === active.id);
        const newIdx = prev.findIndex(s => s.id === over.id);
        return arrayMove(prev, oldIdx, newIdx);
      });
    }
  }, []);

  const removeStep = useCallback((id: string) => {
    setSteps(prev => prev.filter(s => s.id !== id));
  }, []);

  const addProvider = (provider: typeof PROVIDER_OPTIONS[0]) => {
    setSteps(prev => {
      const blockIdx = prev.findIndex(s => s.type === 'block');
      const newStep: ChainStep = {
        id: makeId(), type: 'provider',
        label: provider.label,
        provider: provider.provider,
        tier: provider.tier,
        model: provider.model,
      };
      if (blockIdx >= 0) {
        const next = [...prev];
        next.splice(blockIdx, 0, newStep);
        return next;
      }
      return [...prev, newStep];
    });
    setAddingProvider(false);
  };

  const addBlock = () => {
    if (steps.some(s => s.type === 'block')) return;
    setSteps(prev => [...prev, { id: makeId(), type: 'block', label: 'Block (stop here)' }]);
  };

  const save = async () => {
    setSaving(true);
    try {
      const chain = steps.map(s => s.type === 'block' ? '__block__' : (s.provider ?? s.id));
      const headers = await getAuthHeaders();
      await fetch(`${API_URL}/api/users/me/fallback-chain`, {
        method: 'PUT',
        headers,
        body: JSON.stringify({ chain }),
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch { /* ignore */ }
    finally { setSaving(false); }
  };

  return (
    <SettingsLayout>
      <div style={{ maxWidth: 540 }}>
        <h1 style={{ fontFamily: 'var(--font-sans)', fontSize: 22, fontWeight: 700, color: 'var(--brand-green)', marginBottom: 6, letterSpacing: '-0.3px' }}>
          Auto-Fallback Routing
        </h1>
        <p style={{ fontSize: 13, color: 'var(--meta)', fontFamily: 'var(--font-sans)', marginBottom: 24, lineHeight: 1.6 }}>
          Drag to reorder. When a provider hits a rate limit, Goblin automatically tries the next one. The <strong>Block</strong> step stops routing and shows an error.
        </p>

        {loading ? (
          <div style={{ height: 200, background: 'var(--paper)', borderRadius: 12, animation: 'pulse 1.5s ease-in-out infinite' }} />
        ) : (
          <>
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
              <SortableContext items={steps.map(s => s.id)} strategy={verticalListSortingStrategy}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 12 }}>
                  {steps.map(step => (
                    <SortableStep key={step.id} step={step} onRemove={removeStep} />
                  ))}
                  {steps.length === 0 && (
                    <div style={{
                      border: '2px dashed #E8E4DC', borderRadius: 9,
                      padding: '20px', textAlign: 'center',
                      fontSize: 13, color: 'var(--disabled)', fontFamily: 'var(--font-sans)',
                    }}>
                      Add at least one provider to your fallback chain.
                    </div>
                  )}
                </div>
              </SortableContext>
            </DndContext>

            {/* Add actions */}
            <div style={{ display: 'flex', gap: 8, marginBottom: 24, flexWrap: 'wrap' }}>
              <div style={{ position: 'relative' }}>
                <button
                  onClick={() => setAddingProvider(p => !p)}
                  style={{
                    padding: '7px 14px',
                    background: '#fff', border: '1px solid #E8E4DC',
                    borderRadius: 8, fontSize: 12, fontWeight: 600,
                    color: 'var(--brand-green)', cursor: 'pointer',
                    fontFamily: 'var(--font-sans)',
                  }}
                >
                  + Add Provider
                </button>
                {addingProvider && (
                  <>
                    <div style={{ position: 'fixed', inset: 0, zIndex: 98 }} onClick={() => setAddingProvider(false)} />
                    <div style={{
                      position: 'absolute', top: 'calc(100% + 4px)', left: 0,
                      background: '#fff', border: '1px solid #E8E4DC',
                      borderRadius: 10, padding: '4px 0',
                      minWidth: 220, zIndex: 99,
                      boxShadow: '0 4px 16px rgba(0,0,0,0.1)',
                    }}>
                      {PROVIDER_OPTIONS.map(opt => (
                        <button
                          key={opt.provider}
                          onClick={() => addProvider(opt)}
                          style={{
                            display: 'block', width: '100%', padding: '8px 14px',
                            background: 'none', border: 'none', textAlign: 'left',
                            fontSize: 13, color: 'var(--text)', cursor: 'pointer',
                            fontFamily: 'var(--font-sans)',
                          }}
                          onMouseEnter={e => (e.currentTarget.style.background = 'var(--paper)')}
                          onMouseLeave={e => (e.currentTarget.style.background = 'none')}
                        >
                          {opt.label}
                        </button>
                      ))}
                    </div>
                  </>
                )}
              </div>

              {!steps.some(s => s.type === 'block') && (
                <button
                  onClick={addBlock}
                  style={{
                    padding: '7px 14px',
                    background: '#fff', border: '1px solid rgba(184,92,60,0.3)',
                    borderRadius: 8, fontSize: 12, fontWeight: 600,
                    color: 'var(--danger)', cursor: 'pointer',
                    fontFamily: 'var(--font-sans)',
                  }}
                >
                  + Add Block
                </button>
              )}
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <button
                onClick={save}
                disabled={saving}
                style={{
                  padding: '9px 22px',
                  background: 'var(--brand-green)', color: '#fff',
                  border: 'none', borderRadius: 8,
                  fontSize: 13, fontWeight: 600,
                  cursor: saving ? 'not-allowed' : 'pointer',
                  fontFamily: 'var(--font-sans)',
                  opacity: saving ? 0.7 : 1,
                }}
              >
                {saving ? 'Saving...' : 'Save chain'}
              </button>
              {saved && (
                <span style={{ fontSize: 13, color: 'var(--success)', fontFamily: 'var(--font-sans)', fontWeight: 500 }}>
                  ✓ Saved
                </span>
              )}
            </div>
          </>
        )}
      </div>
      <style>{`
        @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.5; } }
      `}</style>
    </SettingsLayout>
  );
}
