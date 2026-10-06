# 🎮 Game Tracker

A Windows desktop hub for the games you're waiting for — release dates, studios, trailers,
screenshots, tags and how much you want each one. Everything is stored locally on your PC.

> **Status:** Phase 1 (core library) — see [docs/PLAN.md](docs/PLAN.md) for the roadmap and
> [docs/HANDOFF.md](docs/HANDOFF.md) for current status and next steps.
> Auto-fill from IGDB, delay/cancellation tracking and news arrive in later phases.

## ✨ What it does today

- **Add, edit and delete games** — every field is editable.
- **Flexible release dates** — exact day, month, quarter, year or **TBA**, all sorted sensibly.
- **Priority** — 🔥 Must Play · ⭐ High · 👍 Interested · 🤔 Maybe · 👀 Watching.
- **Tags** with colors, plus your own status (Wishlist, Pre-ordered, Bought, Playing, Finished, Skipped).
- **Card grid ⇄ table** — sort by any field, filter by anything, save views you use often.
- **Dark and light themes.**

## ⬇️ Get the app (portable .exe)

1. Open the repository's **Actions** tab → latest **CI** run → **Artifacts** →
   download `GameTracker-<version>-portable-windows`.
2. Unzip and run `GameTracker-<version>-portable.exe` — no installation needed.

> ⚠️ **"Windows protected your PC"** — the app isn't code-signed yet, so SmartScreen may warn on
> first launch. Click **More info → Run anyway**.
>
> The app needs the Microsoft **WebView2** runtime, which ships with Windows 10 (updated) and 11.

**Your data** lives in `%APPDATA%\io.github.dramadanov.gametracker\gametracker.db` (a single
SQLite file). It stays there if you move or replace the `.exe`.

## ⌨️ Shortcuts

| Keys | Action |
|---|---|
| `Ctrl+N` | Add a game |
| `Ctrl+F` or `/` | Search |
| `Ctrl+Enter` | Save in the editor |
| `E` | Edit the open game |
| `Esc` | Close dialogs |

## 🛠️ Development

Requirements: Node 22+, Rust (stable). On Linux also the
[Tauri system dependencies](https://v2.tauri.app/start/prerequisites/).

```bash
npm install
npm run dev          # browser dev build (uses an in-browser SQLite, data in localStorage)
npm run tauri dev    # desktop app
npm test             # unit tests (vitest)
npm run e2e          # UI tests (Playwright)
npm run typecheck && npm run lint
npx tauri build --no-bundle   # portable desktop executable
```

In the browser dev build, `await window.__gameTracker.seedSample()` in the console loads a
fictional sample library (`window.__gameTracker.clear()` empties it).

### Project layout

```
src/
  domain/      types, release-date logic, sorting & filtering (pure, unit-tested)
  db/          Db interface, migrations, drivers (Tauri SQLite plugin / sql.js)
  data/        repository: rows ⇄ domain objects
  state/       zustand store + selector hooks
  components/  ui kit, sidebar, toolbar, library (grid/table), detail, editor, tags
src-tauri/     Rust shell (window, SQLite + opener plugins)
tests/e2e/     Playwright UI tests
docs/PLAN.md   product plan & phases
```
