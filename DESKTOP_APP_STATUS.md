# Goblin Desktop App (Tauri) — Status

## Stand: Session 3 (2026-05-12) — Nicht gestartet

Phase M wurde in Session 3 zugunsten von N3/O/P/R/S zurückgestellt.
Die Web-App-Polish hatte laut Briefing immer Priorität über das Tauri-Skelett.

---

## Was in Session 2/3 vorbereitet wurde (Web-Seite)

- `apps/web/lib/hardware-check.ts` — Hardware-Detection für Browser (Session 1, Phase B)
- `apps/web/app/dashboard/settings/local/page.tsx` — Local Mode Settings UI
- Knowledge Base: Local Mode FAQ hinzugefügt (Session 3, Phase N3)

---

## Was für Phase M in Session 4 zu tun ist

### Voraussetzungen (Dario muss installiert haben)
- Rust 1.77+ (`rustup toolchain install stable`)
- Xcode Command Line Tools (`xcode-select --install`)
- Node 20+ (bereits vorhanden)

### Schritt-für-Schritt

```bash
# 1. Tauri CLI installieren
cargo install tauri-cli --version "^2.0"

# 2. In das Desktop-App-Verzeichnis
cd apps/desktop

# 3. Tauri initialisieren (falls noch kein src-tauri Verzeichnis)
pnpm tauri init

# Konfiguration wenn gefragt:
# - App name: Goblin
# - Window title: Goblin
# - Web assets: ../../apps/web/out (oder ../.next für dev)
# - Dev URL: http://localhost:3000
# - Build command: pnpm build
# - Dev command: pnpm dev

# 4. Rust-Commands implementieren (noch zu erstellen)
# apps/desktop/src-tauri/src/commands/ollama.rs
# apps/desktop/src-tauri/src/commands/system_info.rs
# apps/desktop/src-tauri/src/commands/filesystem.rs
# apps/desktop/src-tauri/src/commands/secrets.rs

# 5. Dev-Start
pnpm tauri dev
```

### Geplante Rust-Commands

| Command | Input | Output |
|---|---|---|
| `check_ollama_status` | — | `{installed, running, version, models}` |
| `pull_ollama_model` | `name: string` | Progress stream |
| `chat_ollama` | `{model, messages}` | Response stream |
| `get_system_info` | — | `{ram_gb, cpu_cores, gpu_name, os, disk_free_gb}` |
| `read_project_file` | `path` | `string` |
| `write_project_file` | `{path, content}` | `void` |
| `open_external` | `url` | `void` |
| `store_secret` | `{key, value}` | `void` |
| `get_secret` | `key` | `string \| null` |

### Frontend-Bridge (zu erstellen)

`apps/web/lib/tauri-bridge.ts`:
```typescript
export const isTauri = typeof window !== 'undefined' && '__TAURI__' in window;

export async function checkOllamaStatus() {
  if (!isTauri) return null;
  const { invoke } = await import('@tauri-apps/api/core');
  return invoke<OllamaStatus>('check_ollama_status');
}
// ... etc
```

---

## Risiken

- Rust-Compile-Fehler auf Windows: Für Session 4 nur macOS als Primärziel
- Stronghold-Plugin (für Secrets): Benötigt zusätzlichen Setup
- Code-Signing für Distribution: Noch nicht nötig für interne Tests

---

## Priorität

**Medium-High** — Ist Kernvision von Dario (Local Mode ohne Cloud), aber
Web-App ist bereits production-ready ohne Desktop-App. Desktop-App
ermöglicht: offline-Betrieb, GPU-Zugriff, keine Trial-Limits.
