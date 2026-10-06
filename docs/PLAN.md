# 🎮 Game Tracker — Project Plan

A Windows desktop hub for tracking new and announced games: info, tags, priority,
delays/cancellations and news — all stored locally, all editable.

---

## ✅ Decisions

| Area | Decision |
|---|---|
| Users | Just me, one PC — no accounts, no server |
| Platforms | All platforms, filterable |
| After release | Game stays, with a personal status (Wishlist / Pre-ordered / Bought / Playing / Finished / Skipped) |
| Discovery | Only games I add (discovery maybe later) |
| Main data source | **IGDB** (free Twitch developer account) |
| News sources | Steam news · major gaming sites (RSS) · official YouTube channels |
| Update checks | On app open + daily from the system tray |
| Notifications | **In-app only** (no Windows pop-ups) — see below |
| Priority | 🔥 Must Play · ⭐ High · 👍 Interested · 🤔 Maybe · 👀 Watching |
| Extras | Release calendar |
| Main view | Card grid **and** table, with a toggle |
| Theme | Dark by default + light option |
| Tech | **Tauri 2 + React + TypeScript**, SQLite |
| Distribution | **Portable .exe** until stable → installer after |
| Size | 50–300 games |
| Backup | Automatic local backups + manual export/import |

### 🔔 Notification rules

- Shown in a **central inbox** (bell icon) and a **per-game timeline**.
- **Cleared automatically** when you open the game (history stays in the timeline).
- **Priority-aware**, configurable — e.g. news only for High+, delays/cancellations for everyone.
- **Color-coded importance**: 🔴 cancelled · 🟠 delayed / date changed · 🔵 new trailer/media · ⚪ news.
- Events: delays & date changes, cancellations, new trailers/media, news articles.

---

## 🧱 Architecture

```
┌──────────────────────── Windows app (Tauri) ────────────────────────┐
│  React UI (TypeScript)                                              │
│   ├─ Grid / Table views, filters, sorting, saved views              │
│   ├─ Game page + editor (every field editable)                      │
│   └─ Store (zustand) ──► Repositories ──► Db interface              │
│                                            ├─ Desktop: SQLite file  │
│                                            └─ Browser dev: sql.js   │
│  Rust shell: window, SQLite plugin, open-links plugin               │
└─────────────────────────────────────────────────────────────────────┘
        Phase 2+: IGDB · Steam · RSS · YouTube (fetched by the app)
```

- ⭐ **One local SQLite file** in `%APPDATA%\io.github.dramadanov.gametracker\` — easy to back up.
- ⭐ **Schema migrations live in TypeScript** so the desktop app and the browser dev build share them.
- ⭐ **Vague release dates are first-class**: `2027`, `Q3 2027`, `Mar 2027`, `Mar 27 2027`, `TBA` — all sort sensibly.
- ⭐ **Your edits win**: each game keeps a list of locked fields that auto-refresh (Phase 2+) never overwrites.
- **GitHub Actions** builds the Windows `.exe` on every push — no Windows machine needed to build.

---

## 🗺️ Phases

Each phase ends with a usable app.

### Phase 1 — Core ✍️ *(in progress)*
- [ ] Add, edit, delete games manually — every field editable
- [ ] Fields: title, summary, cover, release date (exact or vague), release status, my status,
      priority, platforms, genres, developers, publishers, tags, screenshots, trailers, links
- [ ] Tags with colors — create, rename, recolor, delete
- [ ] Priority levels (named, with emoji)
- [ ] Card grid ⇄ table toggle
- [ ] Sort by any field (click table headers or pick from the sort menu)
- [ ] Filters: search, priority, statuses, tags, platforms, genres, release window
- [ ] Saved views (save the current filters + sort under a name)
- [ ] Dark / light theme
- [ ] Local SQLite database with migrations
- [ ] GitHub Actions: tests + portable Windows `.exe` build

### Phase 2 — Auto-fill 🔎
- [ ] In-app setup screen for the IGDB (Twitch) key
- [ ] Search IGDB by name → pick → import all info
- [ ] Screenshots & covers cached locally
- [ ] Trailers from IGDB (YouTube)
- [ ] Field locks: manual edits are never overwritten

### Phase 3 — Watchdog 🕵️
- [ ] Refresh on app open + daily from the system tray
- [ ] Detect delays, date changes, cancellations, new trailers/media
- [ ] Change history per game (timeline)
- [ ] In-app notification inbox with importance colors + priority rules

### Phase 4 — News & media 📰
- [ ] Steam news per game
- [ ] Gaming-site RSS feeds (add/remove sources, mute noisy ones)
- [ ] Official YouTube channels (new videos/trailers)
- [ ] Smarter matching (game + studio name) to avoid false hits

### Phase 5 — Polish ✨
- [ ] Release calendar view
- [ ] Automatic local backups + export/import (JSON/CSV)
- [ ] Installer (once stable)
- [ ] Keyboard shortcuts, performance pass, small UX fixes

---

## ⚠️ Key points

- **Release dates are messy** — the app stores precision (day / month / quarter / year / TBA).
- **News matching by name can be noisy** (*Control*, *Prey*) — match on game + studio, let sources be muted.
- **Cloud dev, Windows target** — UI is built and tested in a browser + Linux build; GitHub builds the
  Windows `.exe`; final click-through happens on the real PC.
- **Cost: $0** — all data sources have free tiers (IGDB is free for non-commercial use).
