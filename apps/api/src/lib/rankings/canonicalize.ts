/**
 * Convert source-specific model identifiers to a single canonical slug.
 * Format: "<provider>/<family>-<version>" lowercase, dashes only.
 */

const PROVIDER_ALIASES: Record<string, string> = {
  'deepseek-ai': 'deepseek',
  'meta-llama': 'meta',
  mistralai: 'mistral',
  qwen: 'alibaba',
  google: 'google',
  anthropic: 'anthropic',
  openai: 'openai',
  cohere: 'cohere',
  'x-ai': 'xai',
};

const DATE_SUFFIX_RE = /-?\d{8}$/;
const DATE_DASH_RE = /-?\d{4}-\d{2}-\d{2}$/;

export function canonicalize(raw: string): string {
  if (!raw) return '';
  let s = raw.toLowerCase().trim();

  let provider = '';
  let model = s;
  if (s.includes('/')) {
    const [p, ...rest] = s.split('/');
    const pKey = p ?? '';
    provider = PROVIDER_ALIASES[pKey] ?? pKey;
    model = rest.join('/');
  }

  model = model.replace(DATE_SUFFIX_RE, '').replace(DATE_DASH_RE, '');
  model = model.replace(/\./g, '-');
  model = model.replace(/\s+/g, '-');

  if (!provider) {
    if (model.startsWith('claude')) provider = 'anthropic';
    else if (
      model.startsWith('gpt') ||
      model.startsWith('o1') ||
      model.startsWith('o3') ||
      model.startsWith('o4')
    )
      provider = 'openai';
    else if (model.startsWith('gemini')) provider = 'google';
    else if (model.startsWith('llama')) provider = 'meta';
    else if (model.startsWith('deepseek')) provider = 'deepseek';
    else if (
      model.startsWith('mistral') ||
      model.startsWith('mixtral') ||
      model.startsWith('codestral')
    )
      provider = 'mistral';
    else if (model.startsWith('qwen')) provider = 'alibaba';
    else if (model.startsWith('command')) provider = 'cohere';
    else if (model.startsWith('grok')) provider = 'xai';
    else provider = 'unknown';
  }

  model = model.replace(/-+/g, '-').replace(/^-|-$/g, '');
  return `${provider}/${model}`;
}

export function extractFamily(canonicalId: string): string {
  const [, model] = canonicalId.split('/');
  if (!model) return 'unknown';
  const parts = model.split('-');
  if (parts[0] === 'gpt') return 'gpt';
  return parts[0] ?? 'unknown';
}
