import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { AdminShell } from '@/components/admin/admin-shell';

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

  // 10.9-5 / §7c — ADMIN_EMAIL fallback when is_admin isn't set (migration 0064
  // unapplied). Env only; never a hardcoded email.
  const adminEmail = process.env.ADMIN_EMAIL;
  const emailAllows = !!adminEmail && !!user.email && user.email.toLowerCase() === adminEmail.toLowerCase();

  if (!userData?.is_admin && !emailAllows) redirect('/dashboard');

  return <AdminShell>{children}</AdminShell>;
}
