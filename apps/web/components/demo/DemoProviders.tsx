"use client";

import { useEffect, type ReactNode } from "react";
import { ThemeProvider } from "@/lib/theme";
import { AppProvider } from "@/contexts/app-context";
import { BuildProvider } from "@/contexts/build-context";
import { UserProvider } from "@/contexts/user-context";
import { DemoModeContext } from "@/lib/demo/demo-mode-context";
import { setDemoActive } from "@/lib/demo/demo-flag";

/**
 * Wraps the demo tree in the production context providers (Theme, App UI state,
 * Build, User) with `demoMode = true`. Sets the demo flag synchronously at render so
 * the first createClient() inside resolves to the demo supabase stub, and clears it
 * on unmount. See docs/DEMO_MODE_ARCHITECTURE.md §5.
 *
 * Provider values are demo-safe by default (the providers hold UI state, not data),
 * so no provider edits are needed beyond mounting them — the DemoModeContext flag +
 * the createClient() choke point do the work.
 *
 * FOUNDER-WALK-7 · U4 follow-up: UserProvider (added here) used to be a plain hook
 * (lib/hooks/useUser.ts, no context) that DashboardShell's Sidebar/AvatarMenu called
 * directly — no provider needed, so this file never had to know about it. Promoting
 * it to a Context (one shared profile instead of five independent copies) means it
 * now needs a mount point, and DemoApp renders the REAL DashboardShell (which
 * renders the real Sidebar/AvatarMenu) outside app/dashboard/layout.tsx's own
 * UserProvider — so it needs its own here, same demo-safe `load()` logic as
 * production (unchanged by that refactor), just reading the demo supabase stub
 * instead of a real session.
 */
export function DemoProviders({ children }: { children: ReactNode }) {
  // Synchronous so a child's first-render createClient() already sees demo mode.
  setDemoActive(true);

  useEffect(() => {
    setDemoActive(true);
    return () => setDemoActive(false);
  }, []);

  return (
    <DemoModeContext.Provider value={true}>
      <ThemeProvider>
        <AppProvider>
          <UserProvider>
            <BuildProvider>{children}</BuildProvider>
          </UserProvider>
        </AppProvider>
      </ThemeProvider>
    </DemoModeContext.Provider>
  );
}
