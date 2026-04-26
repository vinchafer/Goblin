import { createClient } from "@/lib/supabase/server";
import { GitHubConnectButton } from "./github-connect-button";

export default async function IntegrationsPage({ searchParams }: { searchParams: Promise<{ [key: string]: string | string[] | undefined }> }) {
  const params = await searchParams;
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();

  // @ts-ignore supabase-js v2.104 / ssr v0.5 type mismatch
  const { data: profile } = await supabase
    .from('users')
    .select('*')
    .eq('id', user?.id ?? '')
    .single() as unknown as { data: { github_username: string | null } | null };

  const githubConnected = !!profile?.github_username;
  const success = params.github === 'connected';

  return (
    <div className="max-w-2xl">
      <h1 className="text-2xl font-semibold mb-6" style={{ color: 'var(--goblin-slate)' }}>Integrations</h1>

      {success && (
        <div className="mb-6 p-4 rounded-lg" style={{ backgroundColor: 'rgba(74, 124, 59, 0.1)', color: 'var(--goblin-good)' }}>
          ✓ GitHub connected successfully!
        </div>
      )}

      <div className="border rounded-xl p-5" style={{ borderColor: 'var(--goblin-light)' }}>
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-medium mb-1" style={{ color: 'var(--goblin-slate)' }}>GitHub</h3>
            <p className="text-sm" style={{ color: 'var(--goblin-gray)' }}>
              Push generated projects directly to GitHub repositories
            </p>
          </div>

          <GitHubConnectButton connected={githubConnected} username={profile?.github_username} />
        </div>
      </div>
    </div>
  );
}