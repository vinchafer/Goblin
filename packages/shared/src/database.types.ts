// Auto-generated Supabase types stub
// Regenerate with: npx supabase gen types typescript --project-ref YOUR_REF

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
          plan: 'none' | 'trial' | 'build' | 'pro' | 'power'
          stripe_customer_id: string | null
          stripe_subscription_id: string | null
          subscription_current_period_end: string | null
          cancel_at_period_end: boolean | null
          cloud_trial_ends_at: string | null
          trial_consumed_at: string | null
          is_comped: boolean | null
          monthly_requests_used: number
          billing_cycle_start: string | null
          github_username: string | null
          github_access_token_encrypted: string | null
          created_at: string
        }
        Insert: Partial<Database['public']['Tables']['users']['Row']>
        Update: Partial<Database['public']['Tables']['users']['Row']>
      }
      projects: {
        Row: {
          id: string
          user_id: string
          name: string
          description: string | null
          color: string | null
          github_repo: string | null
          model_preferences: Json | null
          storage_path: string | null
          preview_url: string | null
          last_deployed_at: string | null
          status: string
          last_active: string | null
          created_at: string
        }
        Insert: Partial<Database['public']['Tables']['projects']['Row']>
        Update: Partial<Database['public']['Tables']['projects']['Row']>
      }
      chat_messages: {
        Row: {
          id: string
          project_id: string
          role: 'user' | 'assistant' | 'system'
          content: string
          model_used: string | null
          source_tier: 'goblin_hosted' | 'free_api' | 'byok' | null
          has_sendtocode: boolean
          created_at: string
        }
        Insert: Partial<Database['public']['Tables']['chat_messages']['Row']>
        Update: Partial<Database['public']['Tables']['chat_messages']['Row']>
      }
      code_injections: {
        Row: {
          id: string
          message_id: string | null
          project_id: string
          user_id: string
          payload: string
          payload_type: 'code' | 'prompt' | 'mixed'
          filename_hint: string | null
          applied_at: string | null
          created_at: string
        }
        Insert: Partial<Database['public']['Tables']['code_injections']['Row']>
        Update: Partial<Database['public']['Tables']['code_injections']['Row']>
      }
      byok_keys: {
        Row: {
          id: string
          user_id: string
          provider: string
          key_encrypted: string
          key_hint: string | null
          status: string
          validated_at: string | null
          revoked_at: string | null
          created_at: string
        }
        Insert: Partial<Database['public']['Tables']['byok_keys']['Row']>
        Update: Partial<Database['public']['Tables']['byok_keys']['Row']>
      }
      models: {
        Row: {
          id: string
          name: string
          slug: string
          provider: string
          layer: 'goblin_hosted' | 'free_api' | 'byok'
          description: string | null
          tags: string[]
          requires_key: boolean
          available: boolean
          phase: number
          created_at: string
        }
        Insert: Partial<Database['public']['Tables']['models']['Row']>
        Update: Partial<Database['public']['Tables']['models']['Row']>
      }
      agent_runs: {
        Row: {
          id: string
          user_id: string
          project_id: string | null
          run_type: string
          model_used: string | null
          source_tier: 'goblin_hosted' | 'free_api' | 'byok' | null
          input_tokens: number | null
          output_tokens: number | null
          status: 'pending' | 'running' | 'success' | 'failed'
          error: string | null
          created_at: string
          completed_at: string | null
        }
        Insert: Partial<Database['public']['Tables']['agent_runs']['Row']>
        Update: Partial<Database['public']['Tables']['agent_runs']['Row']>
      }
      push_subscriptions: {
        Row: {
          id: string
          user_id: string
          endpoint: string
          keys: Json
          created_at: string
        }
        Insert: Partial<Database['public']['Tables']['push_subscriptions']['Row']>
        Update: Partial<Database['public']['Tables']['push_subscriptions']['Row']>
      }
    }
    Views: Record<string, never>
    Functions: Record<string, never>
    Enums: Record<string, never>
  }
}