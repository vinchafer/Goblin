"use client";

import { useEffect, type ReactNode } from "react";
import { ThemeProvider } from "@/lib/theme";
import { AppProvider } from "@/contexts/app-context";
import { BuildProvider } from "@/contexts/build-context";
import { DemoModeContext } from "@/lib/demo/demo-mode-context";
import { setDemoActive } from "@/lib/demo/demo-flag";

/**
 * Wraps the demo tree in the production context providers (Theme, App UI state,
 * Build) with `demoMode = true`. Sets the demo flag synchronously at render so the
 * first createClient() inside resolves to the demo supabase stub, and clears it on
 * unmount. See docs/DEMO_MODE_ARCHITECTURE.md §5.
 *
 * Provider values are demo-safe by default (the providers hold UI state, not data),
 * so no provider edits are needed — only the DemoModeContext flag + the
 * createClient() choke point do the work.
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
          <BuildProvider>{children}</BuildProvider>
        </AppProvider>
      </ThemeProvider>
    </DemoModeContext.Provider>
  );
}
