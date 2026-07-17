// WAVE-E E2 — framework project templates (D-E3 = react-vite for v1).
//
// A template is the buildable BASELINE the agent scaffolds via the
// `create_project_structure` tool and then extends (add component → wire import →
// build stays green). It is a code-level constant (versioned, testable, allowlist-
// checkable) — distinct from the DB `templates` table, which is the user-browsable
// gallery.
//
// The React/Vite baseline follows the SAME beauty contract as generated HTML
// (APP_DESIGN_FOUNDATION / D-G): a deliberate Google-Font pairing (Space Grotesk +
// IBM Plex Sans), a coherent Sage & Copper :root palette, mobile-first at 375px, a
// prefers-color-scheme dark variant, generous spacing — so a freshly scaffolded app
// already looks like something a stranger would want to show someone.
//
// Every dependency here is on the E3 allowlist (deps-allowlist.ts), pinned to an exact
// version (D-E2 = allowlist + lockfile-pinning). Vercel builds it from source on the
// user's own account (D-E1 = A); `vercelFramework` is the projectSettings.framework
// value the deploy path sends instead of null.

export type FrameworkId = 'react-vite';

export interface FrameworkTemplate {
  id: FrameworkId;
  /** Human label (DE) for tool results and the honest "supported frameworks" list. */
  label: string;
  /** The Vercel projectSettings.framework value (E3 deploy path). */
  vercelFramework: string;
  /** Exact-pinned deps the template declares (must all be on the E3 allowlist). */
  dependencies: Record<string, string>;
  devDependencies: Record<string, string>;
  /** path → content. Written as drafts through the normal STC write pipeline. */
  files: Record<string, string>;
}

const REACT_VITE_DEPS = {
  react: '18.3.1',
  'react-dom': '18.3.1',
} as const;

const REACT_VITE_DEV_DEPS = {
  '@vitejs/plugin-react': '4.3.4',
  '@types/react': '18.3.12',
  '@types/react-dom': '18.3.1',
  typescript: '5.6.3',
  vite: '5.4.11',
} as const;

function reactViteFiles(appName: string): Record<string, string> {
  const pkgName = appName
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40) || 'meine-app';

  const pkg = {
    name: pkgName,
    private: true,
    version: '0.1.0',
    type: 'module',
    scripts: {
      dev: 'vite',
      build: 'tsc && vite build',
      preview: 'vite preview',
    },
    dependencies: { ...REACT_VITE_DEPS },
    devDependencies: { ...REACT_VITE_DEV_DEPS },
  };

  return {
    'package.json': JSON.stringify(pkg, null, 2) + '\n',

    '.gitignore': `node_modules
dist
*.local
.DS_Store
`,

    'index.html': `<!doctype html>
<html lang="de">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${escapeHtml(appName)}</title>
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
    <link
      href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@500;700&family=IBM+Plex+Sans:wght@400;500&display=swap"
      rel="stylesheet"
    />
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
`,

    'vite.config.ts': `import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
});
`,

    'tsconfig.json': `{
  "compilerOptions": {
    "target": "ES2020",
    "useDefineForClassFields": true,
    "lib": ["ES2020", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "skipLibCheck": true,
    "moduleResolution": "bundler",
    "allowImportingTsExtensions": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": true,
    "jsx": "react-jsx",
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true
  },
  "include": ["src"],
  "references": [{ "path": "./tsconfig.node.json" }]
}
`,

    'tsconfig.node.json': `{
  "compilerOptions": {
    "composite": true,
    "skipLibCheck": true,
    "module": "ESNext",
    "moduleResolution": "bundler",
    "allowSyntheticDefaultImports": true,
    "strict": true,
    "noEmit": true
  },
  "include": ["vite.config.ts"]
}
`,

    'src/main.tsx': `import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './index.css';

const container = document.getElementById('root');
if (!container) {
  throw new Error('Root-Element #root wurde nicht gefunden.');
}

createRoot(container).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
`,

    'src/App.tsx': `import './App.css';

// Startpunkt deiner App. Ersetze diesen Inhalt oder baue neue Komponenten in
// src/components und importiere sie hier.
export default function App() {
  return (
    <main className="shell">
      <span className="badge">Bereit zum Bauen</span>
      <h1>${escapeJsx(appName)}</h1>
      <p className="lead">
        Deine React-App läuft. Sag mir, was sie können soll — ich lege die
        Komponenten an, verdrahte die Importe und halte den Build grün.
      </p>
    </main>
  );
}
`,

    'src/index.css': `:root {
  /* Sage & Copper — eine kohärente, aus dem Thema abgeleitete Palette. */
  --sage: #5c7266;
  --sage-deep: #3d4f45;
  --copper: #b06a3c;
  --cream: #f7f3ec;
  --ink: #211d18;
  --muted: #6b655c;
  --radius: 0.75rem;
  --shadow: 0 1px 2px rgba(33, 29, 24, 0.06), 0 8px 24px rgba(33, 29, 24, 0.08);
}

* {
  box-sizing: border-box;
}

html,
body {
  margin: 0;
  min-height: 100%;
}

body {
  font-family: 'IBM Plex Sans', system-ui, sans-serif;
  line-height: 1.6;
  color: var(--ink);
  background: radial-gradient(120% 120% at 50% 0%, #fffdf8 0%, var(--cream) 60%);
}

#root {
  min-height: 100vh;
  display: grid;
  place-items: center;
  padding: 24px;
}

@media (prefers-color-scheme: dark) {
  :root {
    --cream: #16130f;
    --ink: #f2ede4;
    --muted: #a79f92;
    --copper: #cf854f;
  }
  body {
    background: radial-gradient(120% 120% at 50% 0%, #211d18 0%, var(--cream) 60%);
  }
}
`,

    'src/App.css': `.shell {
  width: 100%;
  max-width: 34rem;
  margin-inline: auto;
  padding: 32px;
  background: color-mix(in srgb, var(--cream) 92%, white);
  border-radius: var(--radius);
  box-shadow: var(--shadow);
  text-align: center;
}

.badge {
  display: inline-block;
  font-family: 'Space Grotesk', sans-serif;
  font-weight: 500;
  font-size: 0.8rem;
  letter-spacing: 0.02em;
  color: var(--sage-deep);
  background: color-mix(in srgb, var(--sage) 18%, transparent);
  padding: 6px 12px;
  border-radius: 999px;
}

h1 {
  font-family: 'Space Grotesk', sans-serif;
  font-weight: 700;
  font-size: clamp(2rem, 6vw, 3rem);
  line-height: 1.1;
  margin: 16px 0 8px;
}

.lead {
  color: var(--muted);
  margin: 0 auto;
  max-width: 28rem;
}

@media (prefers-color-scheme: dark) {
  .shell {
    background: color-mix(in srgb, var(--cream) 82%, black);
  }
}
`,
  };
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// App names land inside JSX text, where `{` `}` `<` `>` would be parsed as syntax.
// Strip the risky characters (names are short human titles, not markup).
function escapeJsx(s: string): string {
  return s.replace(/[{}<>]/g, '').trim() || 'Meine App';
}

export const FRAMEWORK_TEMPLATES: Record<FrameworkId, Omit<FrameworkTemplate, 'files'> & { build: (appName: string) => Record<string, string> }> = {
  'react-vite': {
    id: 'react-vite',
    label: 'React + Vite (TypeScript)',
    vercelFramework: 'vite',
    dependencies: { ...REACT_VITE_DEPS },
    devDependencies: { ...REACT_VITE_DEV_DEPS },
    build: reactViteFiles,
  },
};

export const SUPPORTED_FRAMEWORKS: FrameworkId[] = Object.keys(FRAMEWORK_TEMPLATES) as FrameworkId[];

/** Resolve a framework id to its template, or null if unsupported (drives the E5
 *  honest "not supported" edge). Case-insensitive; accepts a few friendly aliases. */
export function getFrameworkTemplate(id: string): FrameworkTemplate | null {
  const norm = id.trim().toLowerCase();
  const alias: Record<string, FrameworkId> = {
    'react-vite': 'react-vite',
    react: 'react-vite',
    vite: 'react-vite',
    'react+vite': 'react-vite',
    reactvite: 'react-vite',
  };
  const resolved = alias[norm];
  if (!resolved) return null;
  const tpl = FRAMEWORK_TEMPLATES[resolved];
  return {
    id: tpl.id,
    label: tpl.label,
    vercelFramework: tpl.vercelFramework,
    dependencies: tpl.dependencies,
    devDependencies: tpl.devDependencies,
    files: tpl.build('Meine App'),
  };
}

/** Build the template's files with a personalized app name (title + package name). */
export function buildFrameworkFiles(id: FrameworkId, appName: string): Record<string, string> {
  return FRAMEWORK_TEMPLATES[id].build(appName && appName.trim() ? appName.trim() : 'Meine App');
}
