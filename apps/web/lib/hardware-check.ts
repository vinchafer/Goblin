'use client';

export interface HardwareInfo {
  ramGB: number | null;
  cpuCores: number | null;
  gpuName: string | null;
  isTauri: boolean;
  confidence: 'high' | 'low'; // low = browser-capped estimates
}

export interface ModelRecommendation {
  name: string;
  slug: string;
  sizeLabel: string;
  ramRequired: number;
  pullCommand: string;
  tag: 'recommended' | 'fast' | 'capable' | 'powerful';
}

const ALL_MODELS: ModelRecommendation[] = [
  { name: 'DeepSeek Coder 1.3B', slug: 'deepseek-coder:1.3b', sizeLabel: '1.3B', ramRequired: 2, pullCommand: 'ollama pull deepseek-coder:1.3b', tag: 'fast' },
  { name: 'Qwen 2.5 Coder 1.5B', slug: 'qwen2.5-coder:1.5b', sizeLabel: '1.5B', ramRequired: 2, pullCommand: 'ollama pull qwen2.5-coder:1.5b', tag: 'recommended' },
  { name: 'Qwen 2.5 Coder 7B', slug: 'qwen2.5-coder:7b', sizeLabel: '7B', ramRequired: 8, pullCommand: 'ollama pull qwen2.5-coder:7b', tag: 'recommended' },
  { name: 'Llama 3.1 8B', slug: 'llama3.1:8b', sizeLabel: '8B', ramRequired: 8, pullCommand: 'ollama pull llama3.1:8b', tag: 'capable' },
  { name: 'Qwen 2.5 Coder 14B', slug: 'qwen2.5-coder:14b', sizeLabel: '14B', ramRequired: 16, pullCommand: 'ollama pull qwen2.5-coder:14b', tag: 'capable' },
  { name: 'Mistral 7B', slug: 'mistral:7b', sizeLabel: '7B', ramRequired: 8, pullCommand: 'ollama pull mistral:7b', tag: 'fast' },
  { name: 'Qwen 2.5 Coder 32B', slug: 'qwen2.5-coder:32b', sizeLabel: '32B', ramRequired: 24, pullCommand: 'ollama pull qwen2.5-coder:32b', tag: 'powerful' },
];

export function detectHardware(): HardwareInfo {
  const isTauri = typeof window !== 'undefined' && '__TAURI__' in window;

  // Browser APIs — navigator.deviceMemory caps at 8, hardwareConcurrency is accurate
  const ramGB = typeof navigator !== 'undefined' && 'deviceMemory' in navigator
    ? (navigator as Navigator & { deviceMemory: number }).deviceMemory
    : null;

  const cpuCores = typeof navigator !== 'undefined' ? navigator.hardwareConcurrency ?? null : null;

  let gpuName: string | null = null;
  try {
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl') ?? canvas.getContext('experimental-webgl') as WebGLRenderingContext | null;
    if (gl) {
      const ext = gl.getExtension('WEBGL_debug_renderer_info');
      if (ext) {
        gpuName = gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) as string ?? null;
      }
    }
  } catch {
    // WebGL not available
  }

  return {
    ramGB,
    cpuCores,
    gpuName,
    isTauri,
    confidence: isTauri ? 'high' : 'low',
  };
}

export function getModelRecommendations(hw: HardwareInfo): ModelRecommendation[] {
  const ram = hw.ramGB ?? 4;
  return ALL_MODELS.filter(m => m.ramRequired <= ram);
}

export function isLocalModeAvailable(): boolean {
  return typeof window !== 'undefined' && '__TAURI__' in window;
}
