import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { AdminShell } from '@/components/admin/admin-shell';
import { resolveAdminAccess } from '@/lib/admin-access';

export const dynamic = 'force-dynamic';

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect('/login');

  const { data: userData } = await supabase
    .from('users')
    .select('is_admin')
    .eq('id', user.id)
    .single() as unknown as { data: { is_admin: boolean } | null };

  const access = resolveAdminAccess({
    isAdmin: userData?.is_admin,
    userEmail: user.email,
    adminEmail: process.env.ADMIN_EMAIL,
  });

  // F-31: a non-admin used to be SILENTLY redirected to /dashboard — the founder
  // "got no access with any account and no error detail". Show an honest access
  // screen instead, naming the account in use so the founder can tell WHICH
  // account is signed in (the usual cause: a personal account without is_admin,
  // or ADMIN_EMAIL not set to this address). We do NOT leak the grant mechanism
  // to arbitrary users — just the honest denial + the current email.
  if (!access.allowed) {
    return (
      <main
        style={{
          minHeight: '100dvh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 24,
          background: 'var(--surface-0, #08170F)',
        }}
      >
        <div
          style={{
            maxWidth: 420,
            width: '100%',
            background: 'var(--panel, #fff)',
            border: '1px solid var(--border)',
            borderRadius: 12,
            padding: 24,
            textAlign: 'center',
          }}
        >
          <h1 style={{ fontFamily: 'var(--font-sans)', fontSize: 18, fontWeight: 700, color: 'var(--text)', margin: '0 0 8px' }}>
            Kein Admin-Zugriff
          </h1>
          <p style={{ fontFamily: 'var(--font-sans)', fontSize: 14, lineHeight: 1.5, color: 'var(--meta)', margin: '0 0 16px' }}>
            Dieses Konto hat keinen Admin-Zugriff. Angemeldet als{' '}
            <strong style={{ color: 'var(--text)' }}>{user.email ?? 'unbekannt'}</strong>.
            Melde dich mit dem Admin-Konto an — oder lass dieses Konto als Admin freischalten.
          </p>
          <a
            href="/dashboard"
            style={{
              display: 'inline-block',
              padding: '10px 16px',
              borderRadius: 8,
              background: 'var(--brand-green)',
              color: 'rgba(255,255,255,0.95)',
              fontFamily: 'var(--font-sans)',
              fontSize: 14,
              fontWeight: 600,
              textDecoration: 'none',
            }}
          >
            Zum Dashboard
          </a>
        </div>
      </main>
    );
  }

  return <AdminShell>{children}</AdminShell>;
}
