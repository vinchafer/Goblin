// Demo-mode public surface. See docs/DEMO_MODE_ARCHITECTURE.md.

export { isDemoActive, setDemoActive } from "./demo-flag";
export { DemoModeContext, useDemoMode } from "./demo-mode-context";
export { createDemoSupabaseClient } from "./demo-supabase";
export { DEMO_USER, type DemoUser } from "./demo-user";
export { DEMO_PROJECT, DEMO_PROJECTS } from "./demo-project";
export { DEMO_CONVERSATION, type DemoMessage } from "./demo-conversation";
export { DEMO_CODE_FILES, type DemoCodeFile } from "./demo-code-files";
export {
  DEMO_PREVIEW_HTML,
  DEMO_PREVIEW_URL,
  DEMO_PREVIEW_DISPLAY_URL,
} from "./demo-preview";
