"use client";

import { useEffect } from "react";
import { initAnalytics } from "@/lib/analytics";

export function PostHogInit() {
  useEffect(() => {
    initAnalytics();
  }, []);
  return null;
}
