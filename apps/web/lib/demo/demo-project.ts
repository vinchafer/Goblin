// The demo project ("Portfolio") — typed against the production Project schema.
// If ProjectSchema changes incompatibly, tsc fails here → demo drift is caught
// at build time (DEMO_MODE_ARCHITECTURE.md §4).

import type { Project } from "@goblin/shared/src/schemas";
import { DEMO_USER } from "./demo-user";

export const DEMO_PROJECT: Project = {
  id: "00000000-0000-4000-8000-000000000010",
  user_id: DEMO_USER.id,
  name: "Portfolio",
  description: "Personal portfolio site",
  color: "#C9A227",
  intent: "landing_page",
  last_active: new Date("2026-06-07T09:00:00.000Z"),
  created_at: new Date("2026-06-01T09:00:00.000Z"),
};

export const DEMO_PROJECTS: Project[] = [DEMO_PROJECT];
