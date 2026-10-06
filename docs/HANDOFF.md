# 🤝 Handoff — where things stand

_Last updated: 2026-10-06 · branch `claude/pensive-darwin-dlry1y`_

## TL;DR

- ✅ **Phase 1 (core) is built and working**: add/edit/delete games, every field editable, vague
  release dates, priority, tags, my-status, grid ⇄ table, sort by any field, filters, saved views,
  sidebar quick views, tag manager, game page with trailers/screenshots/links, dark/light theme,
  local SQLite.
- ✅ **Verified**: typecheck + lint clean · **360 unit tests** pass · **40 UI (e2e) tests** pass
  (+5 marked `fixme` = known bugs below) · **desktop smoke test passed** on the real Tauri app
  (SQLite file created, data survives restart) · **CI green**, including the **Windows portable
  `.exe` build** (artifact `GameTracker-0.1.0-portable-windows`).
- ⏳ **Not done yet**: a review/fix pass was started and **interrupted** (see below) — 13 known
  issues are open, none fixed yet. The app has **not been tried on a real Windows PC** yet.

## 🔜 Next steps (in order)

1. **Fix the open issues** below; un-`fixme` the matching e2e tests as each one is fixed.
2. **Finish the review** that was cut short: a visual/UX pass (screenshots of every screen,
   dark + light, 1320×840 and 960×600) and an accessibility + security pass (keyboard-only
   walkthrough, contrast, CSP/capabilities/URL handling, DEV hook excluded from production build).
3. **Try it on Windows**: download the CI artifact → run the `.exe` (SmartScreen: More info → Run
   anyway) → add/edit games, restart, check data in `%APPDATA%\io.github.dramadanov.gametracker\`,
   check that trailer/links open in the default browser and remote images load.
4. Tick Phase 1 in `docs/PLAN.md`, bump/tag `v0.1.0` (the CI `release` job publishes the exe for
   `v*` tags).
5. Start **Phase 2 — Auto-fill from IGDB** (notes at the bottom).

## 🐞 Open issues

Found by the code-correctness reviewer (all confirmed with Playwright repro scripts) and the
functional-QA reviewer (each has a `test.fixme` in `tests/e2e/`). Nothing below is fixed yet.

### Medium

1. **Dialog can close itself after repeated Esc** — Chromium/WebView2 stops honouring
   `preventDefault()` on the dialog `cancel` event after repeated Esc without user activation and
   closes the `<dialog>` natively. `Modal` never listens for `close`, so React still thinks the
   editor is open: the editor vanishes and **Add game / Ctrl+N stop working**.
   _Fix_: in `src/components/ui/Modal.tsx` listen for `close`; if it fires while `open` is still
   true, call `onClose()` or re-`showModal()`. Alternative: `closedby="none"` + own Esc handling.
2. **Toasts over dialogs can't be clicked** — the toast popover is in the top layer but inert
   while a modal is open, so clicking a toast's × hits the backdrop and **closes the dialog**
   (e.g. "Added …" toast during *Save & add another*).
   _Fix_: render toasts inside the topmost open `<dialog>` (portal), or make Modal's backdrop
   handler ignore clicks inside `.toasts`; consider skipping the global "Added" toast in the editor.
3. **Past-dated games vanish from quick views** — a game still marked *Announced* whose date has
   passed matches neither **Upcoming** (date in past) nor **Released** (status not Released).
   _Decide_: e.g. show such games under Released (or a "Needs update" view). Phase 3's watchdog
   will update statuses automatically. (`src/domain/filtering.ts` `matchesReleaseWindow`;
   e2e `filters.spec.ts` fixme.)

### Low

4. **Backdrop click closes on `mousedown`, before blur** — a typed tag rename in Manage tags or
   un-committed chip text in the editor is lost; the editor closes without "Discard changes?".
   _Fix_: close on `click` (mousedown+mouseup both on backdrop) or blur the active element first.
   (e2e `tags.spec.ts` fixme.)
5. **Popover swallows Esc meant for a dialog opened above it** (document-level capture listener).
   _Fix_: only handle Esc when focus is inside the popover; close popovers when a dialog opens.
6. **Tag typed in the editor's Tags box is dropped on Save** (other list boxes keep typed text).
   (`src/components/editor/TagSelector.tsx`; e2e `editor.spec.ts` fixme.)
7. **Tags created in the editor persist even if the new game is discarded** (orphan tag with
   0 games). (e2e `editor.spec.ts` fixme.)
8. **Deleting a tag silently broadens saved views that filter on it.** Mention affected views in
   the confirm dialog (and/or offer to delete views whose only filter was that tag).
9. **Saved-view state**: `viewKey` is array-order-sensitive (toggling a tag off/on shows a false
   "· edited"), and `activeSavedViewId` isn't restored after restart (heading says "Library").
   _Fix_: normalise arrays in `viewKey`; persist `activeSavedViewId` with `lastView`.
   (e2e `filters.spec.ts` fixme.)
10. **"Discard changes?" focuses the destructive button** — Esc then Enter throws the draft away.
    Add an `autoFocus: 'confirm' | 'cancel'` prop to `ConfirmDialog`; use cancel for discard.
11. **Popover menus don't flip near the bottom/right edge** (priority/status pickers in the last
    table rows / right-most grid column). Move the sidebar's `opensUpward` logic into `Popover`.
12. **Light theme flashes dark on start** (theme is applied after the DB loads). Mirror the theme
    in `localStorage` and apply it in `main.tsx` before rendering.
13. **Renaming a saved view allows duplicate names** (the Save-view dialog forbids them).

### Known limitations / design questions (not bugs)

- The table is ~50 px wider than the content pane at the default 1320 px window → slight
  horizontal scroll (Title column is sticky).
- Search also matches priority/status labels ("high" finds High-priority games).
- "This year" / "Next year" windows include released and cancelled games.
- Sidebar footer version `v0.1.0` is hard-coded.
- Trailers open in the browser; no in-app player yet.

## 🧰 Setting up a new environment

**Cloud Claude Code session (Linux):**
```bash
npm ci
npm run typecheck && npm run lint && npm test
PW_CHROMIUM_PATH=/opt/pw-browsers/chromium npm run e2e
```
Desktop smoke test (optional, ~5 min first build):
```bash
sudo apt-get update && sudo apt-get install -y libwebkit2gtk-4.1-dev build-essential libxdo-dev \
  libssl-dev libayatana-appindicator3-dev librsvg2-dev webkit2gtk-driver xvfb
cargo install tauri-driver --locked
npx tauri build --debug --no-bundle && xvfb-run -a node tests/desktop/smoke.mjs
```

**Local Windows machine:** Node 22+, Rust (MSVC toolchain, via rustup), then
`npm ci` and `npm run tauri dev` for the desktop app with hot reload.

## 🧭 Phase 2 notes (IGDB auto-fill)

- **Credentials**: user creates a Twitch developer app → Client ID + Secret. Token: POST
  `https://id.twitch.tv/oauth2/token?client_id=…&client_secret=…&grant_type=client_credentials`.
- **API**: POST `https://api.igdb.com/v4/games` with headers `Client-ID`, `Authorization: Bearer …`
  and an Apicalypse body, e.g. `search "elden"; fields name,summary,cover.image_id,genres.name,
  involved_companies.company.name,involved_companies.developer,involved_companies.publisher,
  release_dates.date,release_dates.category,release_dates.platform.name,platforms.name,
  screenshots.image_id,videos.video_id,videos.name,websites.url,websites.category,game_status; limit 10;`
  Rate limit ≈ 4 requests/s. Free for non-commercial use.
- **Do requests from Rust** (`tauri-plugin-http`) to avoid CORS; scope the capability to
  `id.twitch.tv` and `api.igdb.com`. Store the credentials locally (settings table for now).
- **Mapping**: release-date category → our precision (`YYYYMMMMDD`→day, `YYYYMMMM`→month,
  `YYYY`→year, `YYYYQ1..Q4`→quarter, `TBD`→`''`); images
  `https://images.igdb.com/igdb/image/upload/t_cover_big/{image_id}.jpg` /
  `t_screenshot_big`; `videos.video_id` → `https://www.youtube.com/watch?v={id}`;
  `externalIds.igdb = String(id)`.
- **Respect `lockedFields`**: any field the user edited manually is never overwritten.
- **Image cache**: download to the app data dir and show via `convertFileSrc` (asset protocol) —
  needs CSP `img-src asset: http://asset.localhost` and the asset-protocol scope.
- **Migrations**: new columns need guarded `ALTER TABLE` (check `PRAGMA table_info` first).
