import { createClient } from "@/lib/supabase/server";
import { GitHubConnectButton } from "./github-connect-button";
import { SettingsLayout } from "@/components/settings/settings-layout";

export default async function IntegrationsPage({ searchParams }: { searchParams: Promise<{ [key: string]: string | string[] | undefined }> }) {
  const params = await searchParams;
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();

  const { data: profile } = await supabase
    .from('users')
    .select('*')
    .eq('id', user?.id ?? '')
    .single() as unknown as { data: { github_username: string | null } | null };

  const githubConnected = !!profile?.github_username;
  const success = params.github === 'connected';

  return (
    <SettingsLayout>
    <div style={{ maxWidth: 800 }}>
      <h1 style={{ fontFamily: 'Fraunces, serif', fontSize: 22, fontWeight: 700, color: 'var(--moss)', marginBottom: 6, letterSpacing: '-0.3px' }}>
        Integrations
      </h1>
      <p style={{ fontSize: 13, color: 'var(--meta)', marginBottom: 28, fontFamily: 'DM Sans, sans-serif' }}>
        Connect external services to push code, deploy, and automate your workflow.
      </p>

      {success && (
        <div style={{ marginBottom: 24, padding: '12px 16px', borderRadius: 10, background: 'rgba(74,124,59,0.1)', color: 'var(--good)', fontSize: 13, fontFamily: 'DM Sans, sans-serif', fontWeight: 500 }}>
          ✓ GitHub connected successfully!
        </div>
      )}

      <div style={{ background: 'var(--panel)', border: '1px solid var(--border)', borderRadius: 14, padding: '20px 24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16 }}>
          <div>
            <h3 style={{ fontSize: 15, fontWeight: 600, color: 'var(--text)', marginBottom: 4, fontFamily: 'DM Sans, sans-serif' }}>GitHub</h3>
            <p style={{ fontSize: 13, color: 'var(--meta)', fontFamily: 'DM Sans, sans-serif' }}>
              Push generated projects directly to GitHub repositories
            </p>
          </div>
          <GitHubConnectButton connected={githubConnected} username={profile?.github_username} />
        </div>
      </div>
    </div>
    </SettingsLayout>
  );
}