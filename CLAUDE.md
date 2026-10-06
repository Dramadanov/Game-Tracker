# Game Tracker — notes for Claude Code

Windows desktop hub for tracking new/announced games. **Tauri 2 + React 19 + TypeScript +
zustand + SQLite.** Single user, data stored locally.

- Product plan, user decisions, phases: `docs/PLAN.md`
- **Current status, open issues and next steps: `docs/HANDOFF.md` — read it first.**

## Commands

```bash
npm ci                       # install (Node 22+)
npm run dev                  # browser dev build at :5173 (sql.js DB in localStorage)
npm run typecheck            # tsc -b (app + node configs)
npm run lint                 # oxlint src tests
npm test                     # vitest unit/integration tests (src/**/*.test.ts)
npm run e2e                  # Playwright UI tests (tests/e2e), starts vite on :4173
npx tauri build --no-bundle  # portable desktop exe (CI does this on Windows)
```

- Pre-installed Chromium (cloud sessions): `PW_CHROMIUM_PATH=/opt/pw-browsers/chromium npm run e2e`.
- Desktop smoke test (Linux; needs `webkit2gtk-driver xvfb` + `cargo install tauri-driver`):
  `npx tauri build --debug --no-bundle && xvfb-run -a node tests/desktop/smoke.mjs`.
- Dev-only console hook (browser build): `await window.__gameTracker.seedSample()` loads 12
  fictional games + 4 tags; `window.__gameTracker.store` is the zustand store; `.clear()` empties.

Before pushing: typecheck, lint, unit tests and e2e must all pass. CI (`.github/workflows/ci.yml`)
runs the same on Ubuntu and builds the portable Windows `.exe` artifact.

## Architecture

```
src/domain/      pure logic: types, constants, releaseDate, game, sorting, filtering (unit-tested)
src/db/          Db interface, migrations.ts, sqljsDb (browser/tests), tauriDb (desktop), index.ts
src/data/        repository.ts — rows ⇄ domain objects, one SQL statement per write
src/state/       store.ts (zustand: data + view + UI state + actions), selectors.ts (hooks)
src/components/  ui/ (shared kit), sidebar/, tags/, toolbar/, library/ (grid+table), detail/, editor/
src/lib/         external.ts — openExternal(url) for ALL external links
src/dev/         sampleData.ts — fictional data, reachable only via the DEV hook in main.tsx
src-tauri/       Rust shell: SQLite (tauri-plugin-sql) + opener plugins, CSP, capabilities
tests/e2e/       Playwright specs + helpers.ts;  tests/desktop/smoke.mjs — real-app WebDriver test
```

## Conventions (keep these)

- **Release dates are strings with their precision**: `''` TBA, `'YYYY'`, `'YYYY-Qn'`, `'YYYY-MM'`,
  `'YYYY-MM-DD'`. Use `releaseDate.ts` helpers (parse/build/format/sort key) — never `new Date()` on them.
- **Sort "asc" = each field's natural order** (priority asc = Must Play first). Empty values always last.
- **Database**: migrations in `src/db/migrations.ts` are append-only and must be re-runnable;
  version lives in `PRAGMA user_version`. The desktop driver uses a connection pool, so **no
  multi-statement transactions** — keep each logical write a single statement (lists are JSON
  columns on the `games` row for that reason). `ALTER TABLE ADD COLUMN` isn't idempotent: guard it
  with `PRAGMA table_info` in future migrations.
- **Store actions** validate, write to the DB, then update memory; on failure they `notify('error', …)`.
- `lockedFields` / `externalIds` on `Game` are reserved for Phase 2 auto-fill (user edits win).
- **Styling**: only CSS variables from `src/styles/tokens.css` (dark default, `[data-theme=light]`).
  Each component folder has its own CSS with a class prefix (`sidebar-`, `tagmgr-`, `toolbar-`,
  `grid-`, `table-`, `detail-`, `editor-`). Must look right in both themes and at 960×600.
- **Dialogs** use the shared `Modal` (native `<dialog>`; `data-autofocus` marks initial focus);
  confirmations use `ConfirmDialog`; messages use `store.notify` (toasts sit in the top layer).
  Never `alert/confirm/prompt`.
- Links/URLs: only http(s) are stored, loaded or opened (`isWebUrl`); open via `openExternal`.
- UI tests rely on `data-testid`s: `toolbar-add-game|filters|sort|save-view|mode-grid|mode-table`,
  `editor-save`, plus `#search-input`, `#editor-title`. Keep them stable.
- TS settings: `verbatimModuleSyntax` (use `import type`), `erasableSyntaxOnly` (no enums),
  no unused locals/params.
