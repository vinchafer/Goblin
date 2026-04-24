import { createClient } from "@/lib/supabase/server";
import { SettingsLayout } from "@/components/settings/settings-layout";
import { Github, Link2, LogOut } from "lucide-react";
import Link from "next/link";

export default async function IntegrationsSettingsPage() {
  const supabase = createClient();
  const { data: user } = await supabase.auth.getUser();

  const { data: userData } = await supabase
    .from('users')
    .select('github_username, github_connected_at')
    .eq('id', user.user?.id)
    .single();

  const isConnected = !!userData?.github_username;

  return (
    <SettingsLayout>
      <div className="max-w-2xl">
        <h1 className="text-2xl font-semibold mb-6" style={{ color: 'var(--goblin-slate)' }}>
          Integrations
        </h1>

        <div className="border rounded-lg overflow-hidden" style={{ borderColor: 'var(--goblin-light)' }}>
          <div className="p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ backgroundColor: 'var(--goblin-light)' }}>
                <Github className="w-5 h-5" style={{ color: 'var(--goblin-slate)' }} />
              </div>
              <div>
                <div className="font-medium" style={{ color: 'var(--goblin-slate)' }}>GitHub</div>
                <div className="text-sm" style={{ color: 'var(--goblin-gray)' }}>
                  {isConnected ? `Connected as @${userData.github_username}` : 'Not connected'}
                </div>
              </div>
            </div>

            {isConnected ? (
              <form action="/api/github/disconnect" method="POST">
                <button className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm" style={{ backgroundColor: 'rgba(184, 92, 60, 0.1)', color: 'var(--goblin-warn)' }}>
                  <LogOut className="w-4 h-4" />
                  Disconnect
                </button>
              </form>
            ) : (
              <Link
                href="/api/github/connect"
                className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium"
                style={{ backgroundColor: 'var(--goblin-moss)', color: 'white' }}
              >
                <Link2 className="w-4 h-4" />
                Connect GitHub
              </Link>
            )}
          </div>
        </div>
      </div>
    </SettingsLayout>
  );
}