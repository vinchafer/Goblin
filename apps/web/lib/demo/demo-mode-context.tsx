"use client";

import { createContext, useContext } from "react";

/**
 * Demo-mode signal for deeply-nested production components (Sidebar, Header,
 * model-switcher, message rows, …) that shouldn't take a prop. Defaults to
 * `false` — every real user, always. Only the demo tree (<DemoProviders>) sets
 * it to `true`. See docs/DEMO_MODE_ARCHITECTURE.md §1.
 */
export const DemoModeContext = createContext<boolean>(false);

export const useDemoMode = (): boolean => useContext(DemoModeContext);
