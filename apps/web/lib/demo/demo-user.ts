// The demo identity. Used by the demo supabase stub (session.user) and any
// production component that reads the signed-in user in demo mode.

export interface DemoUser {
  id: string;
  email: string;
  user_metadata: { name: string; full_name: string };
}

export const DEMO_USER: DemoUser = {
  id: "00000000-0000-4000-8000-000000000001",
  email: "demo@justgoblin.com",
  user_metadata: { name: "Demo", full_name: "Demo Builder" },
};
