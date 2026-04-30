import { createClient } from "@/lib/supabase/server";
import { SettingsLayout } from "@/components/settings/settings-layout";
import { KeysList } from "@/components/settings/keys-list";

export default async function KeysSettingsPage() {
  const supabase = await createClient();

  const { data: keys } = await supabase
    .from('byok_keys')
    .select('id, provider, label, status, last_used, created_at')
    .order('created_at', { ascending: false });

  return (
    <SettingsLayout>
      <div style={{ maxWidth: '800px' }}>
        <h1 style={{ fontSize: '24px', fontWeight: 600, color: '#2A2A2A', marginBottom: '8px', fontFamily: 'DM Sans, sans-serif' }}>
          API Keys
        </h1>
        <p style={{ fontSize: '14px', color: '#6B6B6B', marginBottom: '32px' }}>
          Connect your own API keys for different AI providers. Your keys are encrypted at rest and never stored in plaintext.
        </p>

        <KeysList initialKeys={keys || []} />
      </div>
    </SettingsLayout>
  );
}