import type { Config } from "tailwindcss";

export default {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}"
  ],
  theme: {
    extend: {
      colors: {
        goblin: {
          moss: "var(--goblin-moss)",
          ochre: "var(--goblin-ochre)",
          cream: "var(--goblin-cream)",
          bark: "var(--goblin-bark)",
          slate: "var(--goblin-slate)",
          gray: "var(--goblin-gray)",
          light: "var(--goblin-light)",
          good: "var(--goblin-good)",
          warn: "var(--goblin-warn)"
        }
      },
      fontFamily: {
        fraunces: ["var(--font-fraunces)"],
        inter: ["var(--font-inter)"]
      }
    }
  },
  plugins: []
} satisfies Config;