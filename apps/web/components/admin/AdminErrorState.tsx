// FOUNDER-WALK-3 U5 — the shared admin error banner.
//
// One presentational component every admin page renders on a load failure, so an
// auth error is never a silent empty table. No hooks → usable from both the client
// pages (insight/users/telemetry/models) and the server pages (costs). Pass a
// `status` (mapped to the shared actionable copy) or an explicit `message`.

import { adminErrorMessage, type AdminErrorStatus } from '@/lib/admin/admin-error';

export function AdminErrorState({
  status,
  message,
  detail,
  style,
}: {
  status?: AdminErrorStatus;
  message?: string;
  detail?: string;
  style?: React.CSSProperties;
}) {
  const text = message ?? (status != null ? adminErrorMessage(status, detail) : 'Fehler');
  return (
    <div
      role="alert"
      style={{
        background: 'rgba(176, 67, 42, 0.10)',
        border: '1px solid var(--danger)',
        color: 'var(--danger)',
        borderRadius: 'var(--radius, 8px)',
        padding: '12px 14px',
        fontSize: 'var(--t-small-fs, 13px)',
        fontFamily: 'var(--font-sans)',
        lineHeight: 1.5,
        ...style,
      }}
    >
      {text}
    </div>
  );
}
