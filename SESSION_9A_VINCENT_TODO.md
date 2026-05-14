# Session 9A — Vincent ToDo

**Priority:** Low — no blockers. App deploys without any of these.

---

## 1. Wire FloatingToolbar into Workspace (Medium effort)

The `FloatingToolbar` component exists at `components/mobile/floating-toolbar.tsx` but isn't connected to the CodeEditor yet. To wire it:

Find where `CodeEditor` is rendered (likely in the code tab of the project workspace), and add:

```tsx
import { FloatingToolbar } from '@/components/mobile/floating-toolbar';
import { EditorView } from 'codemirror';
import { useState } from 'react';

// In the component:
const [editorView, setEditorView] = useState<EditorView | null>(null);

// In JSX:
<CodeEditor
  {...existingProps}
  onEditorReady={setEditorView}
/>
<FloatingToolbar editorView={editorView} onSave={handleSave} />
```

## 2. GoblinMark SVG — Optional Design Polish

The SVG goblin mark (`components/ui/goblin-mark.tsx`) is geometric and clean. If you want more character, a designer could refine it. The current version is better than the red 👺 emoji.

## 3. `lucide-react` Package Cleanup (Very Low)

The package is still in `apps/web/package.json` (0 imports). Can remove it whenever:
```bash
pnpm remove lucide-react --filter @goblin/web
```

## 4. Verify Voice Input on iPhone Safari

Voice input is enabled via Web Speech API. Test on actual iPhone:
- Open project chat on iPhone Safari
- Mic icon should appear
- Tap → browser will ask for microphone permission
- Speak → text appears in chat input

Known limitation: Safari iOS sometimes requires a user-gesture first. Already handled via `onPointerDown`.

## 5. Advanced Mode — Per-Feature Gating (Session 9B)

The `<AdvancedOnly>` wrapper and `useAdvancedMode()` hook are ready. Session 9B can add:
- Token count display in chat messages
- Model latency badge
- File-tree hidden file toggle
- Custom LiteLLM config editor in Settings

---

No Railway changes needed. No DB migrations needed. All code on master.
