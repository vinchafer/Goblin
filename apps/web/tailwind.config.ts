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
          green:  "#0F2B1E",
          moss:   "#2D4A2B",
          gold:   "#D4A737",
          ochre:  "#D4A94A",
          cream:  "#F7F4ED",
          white:  "#FFFFFF",
          black:  "#111111",
        },
      },
      fontFamily: {
        sans:     ["var(--font-dm-sans)", "system-ui", "sans-serif"],
        display:  ["var(--font-fraunces)", "Georgia", "serif"],
        fraunces: ["var(--font-fraunces)"],
        mono:     ["var(--font-mono)", "ui-monospace", "monospace"],
      },
      fontSize: {
        display: ["88px", { lineHeight: "0.96", letterSpacing: "-0.04em" }],
        h1:      ["56px", { lineHeight: "1.02", letterSpacing: "-0.03em" }],
        h2:      ["40px", { lineHeight: "1.05", letterSpacing: "-0.025em" }],
        h3:      ["24px", { lineHeight: "1.2",  letterSpacing: "-0.02em" }],
      },
      letterSpacing: {
        tighter: "-0.04em",
        tight:   "-0.025em",
        wide:    "0.04em",
        wider:   "0.08em",
        widest:  "0.18em",
      },
      borderRadius: {
        icon: "22.5%",
      },
      keyframes: {
        "goblin-thinking": {
          "0%, 100%": { transform: "translateY(0)" },
          "50%":      { transform: "translateY(-3px)" },
        },
        "goblin-working": {
          "0%, 100%": { opacity: "1" },
          "50%":      { opacity: "0.6" },
        },
      },
      animation: {
        "goblin-thinking": "goblin-thinking 0.6s ease-in-out infinite",
        "goblin-working":  "goblin-working 1.8s ease-in-out infinite",
      },
    },
  },
  plugins: []
} satisfies Config;
