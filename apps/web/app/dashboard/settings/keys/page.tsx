// LEGACY — superseded by SettingsRoot + SettingsModal. Direct-URL
// access only. Do not extend; future settings additions belong in
// SettingsRoot (apps/web/components/settings/SettingsRoot.tsx)
// and components/settings/sections.ts.
import { createClient } from "@/lib/supabase/server";
import { SettingsLayout } from "@/components/settings/settings-layout";
import { KeysList } from "@/components/settings/keys-list";

export const dynamic = 'force-dynamic';

export default async function KeysSettingsPage() {
  const supabase = await createClient();

  // 'label' requires migration 0028. Use graceful fallback if column absent.
  const { data: keys } = await supabase
    .from('byok_keys')
    .select('id, provider, key_hint, status, last_used, created_at, validated_at')
    .order('created_at', { ascending: false });

  const FREE_TIER_PROVIDERS = [
    { name: 'Groq', description: 'Llama 3.3 70B — fast inference, generous free tier', url: 'https://console.groq.com/keys', badge: 'Free' },
    { name: 'Google AI Studio', description: 'Gemini 2.0 Flash — 1,500 requests/day free', url: 'https://aistudio.google.com/app/apikey', badge: 'Free' },
    { name: 'OpenRouter', description: 'Access 50+ models including free DeepSeek R1', url: 'https://openrouter.ai/keys', badge: 'Free tier' },
    { name: 'Anthropic', description: 'Claude 3.5 Haiku/Sonnet — pay-per-use, no subscription', url: 'https://console.anthropic.com/settings/keys', badge: 'BYOK' },
  ];

  return (
    <SettingsLayout>
      <div style={{ maxWidth: '800px' }}>
        <h1 style={{ fontFamily: 'var(--font-sans)', fontSize: 22, fontWeight: 700, color: 'var(--brand-green)', marginBottom: 6, letterSpacing: '-0.3px' }}>
          API Keys
        </h1>
        <p style={{ fontSize: 13, color: 'var(--meta)', marginBottom: 28, fontFamily: 'var(--font-sans)' }}>
          Connect your own API keys. Keys are encrypted at rest with your account&apos;s unique key — never stored in plaintext.
        </p>

        {/* Free Tier Recommendations */}
        <div style={{ background: 'rgba(74,124,59,0.06)', border: '1px solid rgba(74,124,59,0.2)', borderRadius: 12, padding: '18px 20px', marginBottom: 28 }}>
          <h2 style={{ fontSize: 14, fontWeight: 700, color: 'var(--brand-green)', fontFamily: 'var(--font-sans)', marginBottom: 14, margin: '0 0 14px' }}>
            Get a free API key to start
          </h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 10 }}>
            {FREE_TIER_PROVIDERS.map(p => (
              <a key={p.name} href={p.url} target="_blank" rel="noopener noreferrer"
                style={{ display: 'block', background: '#fff', border: '1px solid var(--border)', borderRadius: 8, padding: '12px 14px', textDecoration: 'none' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                  <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)', fontFamily: 'var(--font-sans)' }}>{p.name}</span>
                  <span style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--brand-green)', background: 'rgba(74,124,59,0.1)', padding: '1px 6px', borderRadius: 3 }}>{p.badge}</span>
                </div>
                <div style={{ fontSize: 11, color: 'var(--meta)', fontFamily: 'var(--font-sans)', lineHeight: 1.4 }}>{p.description}</div>
                <div style={{ fontSize: 11, color: 'var(--brand-green)', fontFamily: 'var(--font-sans)', marginTop: 6, fontWeight: 500 }}>Get key →</div>
              </a>
            ))}
          </div>
        </div>

        <KeysList initialKeys={keys || []} />
      </div>
    </SettingsLayout>
  );
}