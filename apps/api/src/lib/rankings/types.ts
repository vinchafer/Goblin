export type SourceId = 'openrouter' | 'aider' | 'livebench' | 'hf' | 'swebench';

export type Dimension =
  | 'coding'
  | 'reasoning'
  | 'math'
  | 'instruction-following'
  | 'speed'
  | 'cost-efficiency'
  | 'overall';

export type TaskType =
  | 'coding'
  | 'reasoning'
  | 'speed'
  | 'cost-efficiency'
  | 'general';

export interface RawAdapterEntry {
  modelId: string;
  provider: string;
  displayName: string;
  scores: Partial<Record<Dimension, number>>;
  meta?: {
    contextTokens?: number;
    pricingInPerMillion?: number;
    pricingOutPerMillion?: number;
    isOpenSource?: boolean;
    releasedAt?: string;
  };
}

export interface AdapterResult {
  sourceId: SourceId;
  fetchedAt: string;
  entries: RawAdapterEntry[];
  error?: string;
}

export interface SourceAdapter {
  id: SourceId;
  fetch(): Promise<AdapterResult>;
}
