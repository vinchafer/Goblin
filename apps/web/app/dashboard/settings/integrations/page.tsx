import { createClient } from "@/lib/supabase/server";
import { GitHubConnectButton } from "./github-connect-button";
import { SettingsLayout } from "@/components/settings/settings-layout";

export const dynamic = 'force-dynamic';

const COMING_SOON = [
  { name: 'GitLab',    description: 'Push to GitLab repositories and trigger CI/CD pipelines.' },
  { name: 'Bitbucket', description: 'Sync with Bitbucket repositories and Jira.' },
];

const DEPLOY_INTEGRATIONS = [
  { name: 'Vercel',   description: 'Deploy preview links and production with every push.' },
  { name: 'Netlify',  description: 'Continuous deployment to Netlify from Goblin projects.' },
  { name: 'Railway',  description: 'One-click deploy to Railway with environment management.' },
];

function IntegrationRow({ name, description, connected, comingSoon, children }: {
  name: string;
  description: string;
  connected?: boolean;
  comingSoon?: boolean;
  children?: React.ReactNode;
}) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16,
      padding: '16px 0',
      borderBottom: '1px solid var(--div)',
      opacity: comingSoon ? 0.55 : 1,
    }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2 }}>
          <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)', fontFamily: 'DM Sans, sans-serif' }}>
            {name}
          </span>
          {connected && (
            <span style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--success)', background: 'rgba(74,124,59,0.1)', padding: '1px 6px', borderRadius: 4 }}>
              Connected
            </span>
          )}
          {comingSoon && (
            <span style={{ fontSize: 10, fontWeight: 600, color: 'var(--meta)', background: 'var(--subtle)', padding: '1px 6px', borderRadius: 4 }}>
              Coming soon
            </span>
          )}
        </div>
        <p style={{ fontSize: 12, color: 'var(--meta)', fontFamily: 'DM Sans, sans-serif', margin: 0 }}>
          {description}
        </p>
      </div>
      {children}
    </div>
  );
}

function SectionCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ background: 'var(--panel)', border: '1px solid var(--border)', borderRadius: 14, padding: '20px 24px', marginBottom: 20 }}>
      <h2 style={{ fontFamily: 'DM Sans, sans-serif', fontSize: 11, fontWeight: 700, color: 'var(--meta)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 4 }}>
        {title}
      </h2>
      {children}
    </div>
  );
}

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

        {/* Source Control */}
        <SectionCard title="Source Control">
          <IntegrationRow
            name="GitHub"
            description="Push generated projects directly to GitHub repositories."
            connected={githubConnected}
          >
            <GitHubConnectButton connected={githubConnected} username={profile?.github_username} />
          </IntegrationRow>
          {COMING_SOON.map(i => (
            <IntegrationRow key={i.name} name={i.name} description={i.description} comingSoon />
          ))}
          <div style={{ paddingBottom: 4 }} />
        </SectionCard>

        {/* Deploy */}
        <SectionCard title="Deploy Platforms">
          {DEPLOY_INTEGRATIONS.map(i => (
            <IntegrationRow key={i.name} name={i.name} description={i.description} comingSoon />
          ))}
          <div style={{ paddingBottom: 4 }} />
        </SectionCard>
      </div>
    </SettingsLayout>
  );
}
