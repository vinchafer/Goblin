// Next.js 16 flat ESLint config. `next lint` was removed in Next 16; lint now
// runs via `eslint .` (see package.json). This makes lint RUNNABLE and honest —
// it does not auto-fix the accumulated debt (a separate sprint) and is not wired
// as a blocking CI gate (founder decision).
import nextCoreWebVitals from 'eslint-config-next/core-web-vitals'

const eslintConfig = [
  ...nextCoreWebVitals,
  {
    ignores: ['.next/**', 'out/**', 'build/**', 'next-env.d.ts'],
  },
]

export default eslintConfig
