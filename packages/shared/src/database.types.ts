export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      users: {
        Row: {
          id: string
          email: string
          plan: "seed" | "craft" | "forge"
          stripe_customer_id: string | null
          stripe_subscription_id: string | null
          monthly_requests_used: number
          monthly_requests_limit: number
          monthly_limit: number
          billing_cycle_start: string
          subscription_current_period_end: string | null
          github_username: string | null
          github_access_token_encrypted: string | null
          github_connected_at: string | null
          created_at: string
        }
        Insert: {
          id: string
          email: string
          plan?: "seed" | "craft" | "forge"
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          monthly_requests_used?: number
          monthly_requests_limit?: number
          monthly_limit?: number
          billing_cycle_start?: string
          subscription_current_period_end?: string | null
          github_username?: string | null
          github_access_token_encrypted?: string | null
          github_connected_at?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          email?: string
          plan?: "seed" | "craft" | "forge"
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          monthly_requests_used?: number
          monthly_requests_limit?: number
          monthly_limit?: number
          billing_cycle_start?: string
          subscription_current_period_end?: string | null
          github_username?: string | null
          github_access_token_encrypted?: string | null
          github_connected_at?: string | null
          created_at?: string
        }
      }
      byok_keys: {
        Row: {
          id: string
          user_id: string
          provider: "anthropic" | "openai" | "google" | "groq" | "mistral" | "deepseek" | "xai" | "together" | "fireworks"
          label: string | null
          key_encrypted: Buffer
          status: "active" | "expired" | "revoked"
          last_used: string | null
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          provider: "anthropic" | "openai" | "google" | "groq" | "mistral" | "deepseek" | "xai" | "together" | "fireworks"
          label?: string | null
          key_encrypted: Buffer
          status?: "active" | "expired" | "revoked"
          last_used?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          provider?: "anthropic" | "openai" | "google" | "groq" | "mistral" | "deepseek" | "xai" | "together" | "fireworks"
          label?: string | null
          key_encrypted?: Buffer
          status?: "active" | "expired" | "revoked"
          last_used?: string | null
          created_at?: string
        }
      }
      projects: {
        Row: {
          id: string
          user_id: string
          name: string
          description: string | null
          color: string
          github_repo: string | null
          model_preferences: Json
          status: string | null
          last_active: string
          last_generated: string | null
          storage_path: string | null
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          name: string
          description?: string | null
          color?: string
          github_repo?: string | null
          model_preferences?: Json
          status?: string | null
          last_active?: string
          last_generated?: string | null
          storage_path?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          name?: string
          description?: string | null
          color?: string
          github_repo?: string | null
          model_preferences?: Json
          status?: string | null
          last_active?: string
          last_generated?: string | null
          storage_path?: string | null
          created_at?: string
        }
      }
      chat_messages: {
        Row: {
          id: string
          project_id: string
          role: "user" | "assistant" | "system"
          content: string
          model_used: string | null
          source_tier: "goblin_hosted" | "free_api" | "byok" | null
          created_at: string
        }
        Insert: {
          id?: string
          project_id: string
          role: "user" | "assistant" | "system"
          content: string
          model_used?: string | null
          source_tier?: "goblin_hosted" | "free_api" | "byok" | null
          created_at?: string
        }
        Update: {
          id?: string
          project_id?: string
          role?: "user" | "assistant" | "system"
          content?: string
          model_used?: string | null
          source_tier?: "goblin_hosted" | "free_api" | "byok" | null
          created_at?: string
        }
      }
      agent_runs: {
        Row: {
          id: string
          user_id: string
          project_id: string
          model_used: string | null
          source_tier: "goblin_hosted" | "free_api" | "byok" | null
          input_tokens: number | null
          output_tokens: number | null
          cost_usd_internal: number | null
          status: "pending" | "running" | "success" | "failed"
          created_at: string
          completed_at: string | null
        }
        Insert: {
          id?: string
          user_id: string
          project_id: string
          model_used?: string | null
          source_tier?: "goblin_hosted" | "free_api" | "byok" | null
          input_tokens?: number | null
          output_tokens?: number | null
          cost_usd_internal?: number | null
          status: "pending" | "running" | "success" | "failed"
          created_at?: string
          completed_at?: string | null
        }
        Update: {
          id?: string
          user_id?: string
          project_id?: string
          model_used?: string | null
          source_tier?: "goblin_hosted" | "free_api" | "byok" | null
          input_tokens?: number | null
          output_tokens?: number | null
          cost_usd_internal?: number | null
          status?: "pending" | "running" | "success" | "failed"
          created_at?: string
          completed_at?: string | null
        }
      }
      code_injections: {
        Row: {
          id: string
          project_id: string
          message_id: string | null
          user_id: string
          payload: string
          payload_type: "code" | "prompt" | "mixed"
          filename_hint: string | null
          applied_at: string | null
          created_at: string
        }
        Insert: {
          id?: string
          project_id: string
          message_id?: string | null
          user_id: string
          payload: string
          payload_type: "code" | "prompt" | "mixed"
          filename_hint?: string | null
          applied_at?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          project_id?: string
          message_id?: string | null
          user_id?: string
          payload?: string
          payload_type?: "code" | "prompt" | "mixed"
          filename_hint?: string | null
          applied_at?: string | null
          created_at?: string
        }
      }
      models: {
        Row: {
          id: string
          name: string
          slug: string
          provider: string
          layer: "goblin_hosted" | "free_api" | "byok"
          description: string | null
          tags: string[]
          requires_key: boolean
          available: boolean
          phase: number
          created_at: string
        }
        Insert: {
          id?: string
          name: string
          slug: string
          provider: string
          layer: "goblin_hosted" | "free_api" | "byok"
          description?: string | null
          tags?: string[]
          requires_key?: boolean
          available?: boolean
          phase?: number
          created_at?: string
        }
        Update: {
          id?: string
          name?: string
          slug?: string
          provider?: string
          layer?: "goblin_hosted" | "free_api" | "byok"
          description?: string | null
          tags?: string[]
          requires_key?: boolean
          available?: boolean
          phase?: number
          created_at?: string
        }
      }
      push_subscriptions: {
        Row: {
          id: string
          user_id: string
          endpoint: string
          keys: { p256dh: string; auth: string }
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          endpoint: string
          keys: { p256dh: string; auth: string }
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          endpoint?: string
          keys?: { p256dh: string; auth: string }
          created_at?: string
        }
      }
    }
  }
}