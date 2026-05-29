import { z } from "zod";

export const ProjectSchema = z.object({
  id: z.string().uuid(),
  user_id: z.string().uuid(),
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
  color: z.string(),
  last_active: z.coerce.date(),
  created_at: z.coerce.date()
});

export const ChatMessageSchema = z.object({
  id: z.string().uuid(),
  project_id: z.string().uuid(),
  role: z.enum(["user", "assistant"]),
  content: z.string(),
  model_used: z.string().optional().nullable(),
  source_tier: z.enum(["goblin_hosted", "free_api", "byok"]).optional().nullable(),
  created_at: z.coerce.date()
});

export const ByokProviderSchema = z.enum([
  "anthropic",
  "openai",
  "google",
  "groq",
  "mistral",
  "deepseek",
  "xai",
  "together",
  "custom",
]);

// `baseURL` is optional for the 8 first-party providers and required when
// `provider === 'custom'` (an OpenAI-compatible endpoint the user brings).
export const CreateByokKeySchema = z.object({
  provider: ByokProviderSchema,
  label: z.string().min(1).max(50).optional(),
  key: z.string().min(1),
  baseURL: z.string().url().optional(),
}).refine(
  (v) => v.provider !== "custom" || (typeof v.baseURL === "string" && v.baseURL.length > 0),
  { message: "baseURL is required when provider is 'custom'", path: ["baseURL"] },
);

export const UpdateByokKeySchema = z.object({
  label: z.string().min(1).max(50).optional()
});

export type Project = z.infer<typeof ProjectSchema>;
export type ChatMessage = z.infer<typeof ChatMessageSchema>;
export type ByokProvider = z.infer<typeof ByokProviderSchema>;
export type CreateByokKey = z.infer<typeof CreateByokKeySchema>;
export type UpdateByokKey = z.infer<typeof UpdateByokKeySchema>;

export interface ByokKey {
  id: string;
  user_id: string;
  provider: ByokProvider;
  label: string;
  key_hint?: string | null;
  status: "active" | "revoked";
  last_used: Date | null;
  created_at: Date;
  validated_at?: Date | null;
}