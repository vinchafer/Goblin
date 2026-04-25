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
      <div className="max-w-2xl">
        <h1 className="text-2xl font-semibold mb-2" style={{ color: 'var(--goblin-slate)' }}>
          BYOK Keys
        </h1>
        <p className="mb-6" style={{ color: 'var(--goblin-gray)' }}>
          Bring your own API keys for Anthropic and OpenAI. Your keys are encrypted at rest.
        </p>

        <KeysList initialKeys={keys || []} />
      </div>
    </SettingsLayout>
  );
}