# Tauri Desktop App — Status

**Phase M: NOT STARTED this session.**

Context constraints prevented Phase M. All web-side preparation is complete:
- `lib/hardware-check.ts` — browser-based hardware detection (Phase B)
- `services/ollama-bridge.ts` — Ollama API wrapper (Phase B)
- Local/Cloud switch UI ready for Tauri activation (Phase B)
- `isLocalModeAvailable()` detects `window.__TAURI__` — works immediately when wrapped

## What's needed to start Tauri in next session

1. `pnpm add -D @tauri-apps/cli` in `apps/desktop/`
2. `pnpm tauri init` with `apps/web` as `distDir`
3. Add Rust commands: `check_ollama_status()`, `get_system_info()`
4. Wire `window.__TAURI__` detection in `lib/hardware-check.ts` → replace browser API estimates with real Rust values

## Estimated effort: 3-4h to demoable skeleton
