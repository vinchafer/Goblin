'use client';

// WAVE-J (J3): the Feedback modal — reachable from every surface that matters
// (account menu, Hilfe, the chat surface, the agent report card). Category + free
// text + a VISIBLE consent line naming exactly what metadata rides along. The
// context is metadata only (page, project id, last error) — never chat content —
// and the server re-sanitizes it regardless. Post-submit: an honest thank-you, no
// fabricated "we'll get back to you in 24h".

import { useState } from 'react';
import { BottomSheet } from '@/components/ui/BottomSheet';
import { apiPost } from '@/lib/api';
import { useLang, t } from '@/lib/use-lang';

export type FeedbackCategory = 'bug' | 'idea' | 'other';
export interface FeedbackContext {
  page?: string;
  project_id?: string;
  last_error?: string;
}

interface FeedbackModalProps {
  open: boolean;
  onClose: () => void;
  /** Where this was opened from — chat | code | help | report_card | menu. */
  surface: string;
  /** Content-free auto-context. Only page/project_id/last_error are ever sent. */
  context?: FeedbackContext;
  /** K3 appeal path: auto-set the category (e.g. a publish-block appeal opens as 'other'). */
  initialCategory?: FeedbackCategory;
}

export function FeedbackModal({ open, onClose, surface, context, initialCategory }: FeedbackModalProps) {
  const lang = useLang();
  const [category, setCategory] = useState<FeedbackCategory>(initialCategory ?? 'idea');
  const [body, setBody] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  const cats: Array<{ id: FeedbackCategory; label: string }> = [
    { id: 'bug', label: t(lang, 'Fehler', 'Bug') },
    { id: 'idea', label: t(lang, 'Idee', 'Idea') },
    { id: 'other', label: t(lang, 'Sonstiges', 'Other') },
  ];

  const reset = () => { setBody(''); setCategory(initialCategory ?? 'idea'); setDone(false); setSubmitting(false); };
  const close = () => { onClose(); setTimeout(reset, 300); };

  const submit = async () => {
    if (!body.trim() || submitting) return;
    setSubmitting(true);
    const ctx: FeedbackContext = {
      page: context?.page ?? (typeof window !== 'undefined' ? window.location.pathname : undefined),
      project_id: context?.project_id,
      last_error: context?.last_error,
    };
    try {
      // The route persists AND emits feedback_submitted server-side (the truth-gate),
      // so the client must NOT emit it too — that would double-count in Pulse.
      await apiPost('/api/feedback', { category, body: body.trim(), context: ctx, surface });
    } catch {
      /* best-effort — thank the user honestly regardless */
    }
    setSubmitting(false);
    setDone(true);
  };

  return (
    <BottomSheet open={open} onClose={close} size="auto" title={t(lang, 'Feedback', 'Feedback')}>
      <div style={{ padding: '4px 16px 20px', fontFamily: 'var(--font-sans)' }}>
        {done ? (
          <div style={{ textAlign: 'center', padding: '24px 8px' }} data-testid="feedback-thanks">
            <div style={{ fontSize: 32, marginBottom: 8 }}>🙏</div>
            <p style={{ fontSize: 15, color: 'var(--text)', margin: '0 0 6px', fontWeight: 600 }}>
              {t(lang, 'Danke — angekommen.', 'Thanks — got it.')}
            </p>
            <p style={{ fontSize: 13, color: 'var(--meta)', margin: '0 0 18px', lineHeight: 1.5 }}>
              {t(lang, 'Wir lesen jedes Feedback. Eine Antwort können wir nicht garantieren.', 'We read every piece of feedback. We can’t promise a reply.')}
            </p>
            <button onClick={close} style={primaryBtn}>{t(lang, 'Schließen', 'Close')}</button>
          </div>
        ) : (
          <>
            <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
              {cats.map((cat) => {
                const active = category === cat.id;
                return (
                  <button
                    key={cat.id}
                    data-testid={`feedback-cat-${cat.id}`}
                    onClick={() => setCategory(cat.id)}
                    style={{
                      flex: 1, minHeight: 44, borderRadius: 10, cursor: 'pointer',
                      fontFamily: 'var(--font-sans)', fontSize: 14, fontWeight: 600,
                      border: active ? '1.5px solid var(--brand-green)' : '1px solid var(--border)',
                      background: active ? 'var(--brand-green)' : 'var(--panel, #fff)',
                      color: active ? '#fff' : 'var(--text)',
                    }}
                  >
                    {cat.label}
                  </button>
                );
              })}
            </div>

            <textarea
              data-testid="feedback-body"
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder={t(lang, 'Was ist dir aufgefallen?', 'What’s on your mind?')}
              rows={4}
              maxLength={4000}
              style={{
                width: '100%', boxSizing: 'border-box', padding: '10px 12px',
                border: '1.5px solid var(--border)', borderRadius: 10, resize: 'vertical',
                fontSize: 14, fontFamily: 'var(--font-sans)', outline: 'none',
                background: 'var(--panel, #fff)', color: 'var(--text)', lineHeight: 1.5,
              }}
            />

            {/* Visible consent line — exactly what metadata is attached. */}
            <p style={{ fontSize: 11.5, color: 'var(--meta)', margin: '10px 0 16px', lineHeight: 1.5 }}>
              {t(lang,
                'Wir senden mit: aktuelle Seite, Projekt-ID, letzte Fehlermeldung — keine Chat-Inhalte.',
                'We attach: current page, project ID, last error message — no chat content.')}
            </p>

            <button
              data-testid="feedback-submit"
              onClick={submit}
              disabled={!body.trim() || submitting}
              style={{ ...primaryBtn, width: '100%', opacity: !body.trim() || submitting ? 0.5 : 1 }}
            >
              {submitting ? t(lang, 'Senden …', 'Sending…') : t(lang, 'Feedback senden', 'Send feedback')}
            </button>
          </>
        )}
      </div>
    </BottomSheet>
  );
}

const primaryBtn: React.CSSProperties = {
  minHeight: 44, padding: '10px 20px', borderRadius: 10, border: 'none', cursor: 'pointer',
  background: 'var(--brand-green)', color: '#fff', fontSize: 14, fontWeight: 600,
  fontFamily: 'var(--font-sans)',
};
