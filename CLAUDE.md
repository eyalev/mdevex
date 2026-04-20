# mdevex

Minimal web-based tmux client with a plugin-first architecture.

## Handoff state (2026-04-18)

The `openmdev → mdevex` rename was just completed via Claude Code from the (now-stale) `openmdev/claude1` working dir. New CC sessions should run from **`/home/eyalev/projects/personal/2026-02/mdevex/claude1/`** (this dir's parent's `claude1/`).

**Nothing has been verified after the rename.** Before doing other work, sanity-check:
- `cd /home/eyalev/projects/personal/2026-02/mdevex && npm start` — should boot the server on port 7682 and load all 7 core plugins without errors
- Open `http://localhost:7682` in a browser — terminal should render, tabs should appear, font-size +/- should work (covers `window.mdevex` global, settings localStorage key, plugin loader)
- `npm test` runs the Playwright spec at `tests/mdevex.spec.js` against an auto-started server on port 7683

If anything is broken, suspect a stale `openmdev` reference. `grep -r openmdev` in the project should only hit `CLAUDE.md` (intentional rename-history mentions). Anywhere else is a stale reference and should be updated to `mdevex`.

**Unrelated in-flight work the user was doing:** added a session-rename feature to the sibling `tmux-web` project (`../tmux-web`, not this repo) — a `PATCH /api/sessions/:session` endpoint plus a pencil icon in the session list. That's tracked separately and doesn't touch `mdevex`.

## Recent renames

**Rename chain:** `web-agent` → `openmdev` (2026-04-17) → `mdevex` (2026-04-18).

Latest rename (`openmdev` → `mdevex`) covered:
- Directory: `openmdev/` → `mdevex/`
- `package.json` name field
- JS global: `window.openmdev` → `window.mdevex`
- Env var: `OPENMDEV_EXTRA_PLUGIN_DIR` → `MDEVEX_EXTRA_PLUGIN_DIR`
- localStorage key: `openmdev-settings` → `mdevex-settings`
- User data paths: `~/.config/openmdev/` → `~/.config/mdevex/`, `~/.openmdev/plugins/` → `~/.mdevex/plugins/`
- Test spec renamed: `tests/openmdev.spec.js` → `tests/mdevex.spec.js`

If you see lingering `openmdev` / `web-agent` / `webAgent` references anywhere, they're stale and should be updated. Old Claude Code session history lives under `~/.claude/projects/-home-eyalev-projects-personal-2026-02-web-agent*` and `~/.claude/projects/-home-eyalev-projects-personal-2026-02-openmdev*` (by old paths).

## Project context

- Independent of `tmux-web` (`../tmux-web`), but born as its modular rewrite. No cross-dependencies.
- `tmux-web` is the mature, monolithic sibling (~9000+ lines, activity dots, CC status tracking, voice dictation, etc.). `mdevex` extracts those features into composable plugins.
- **Port:** 7682 (HTTP/WS). Playwright tests use 7683.
- **One git commit** (initial) plus significant uncommitted work (the plugin architecture refactor + the renames).

## Subdirectories

- `claude1/` — Claude Code working subdirectory. This is where CC sessions typically run from. Has `.claude/docs/` with a project overview written by a prior CC session.
- `core-plugins/` — 7 bundled plugins (tab-bar, xterm, tmux-backend, status-bar, settings-panel, font-size, touch-scroll).
- `plugins/` — user plugins (empty, has README).
- `tests/` — Playwright tests (mobile Pixel 7 profile).

## Plugin architecture (quick reference)

- Plugin dirs searched in order: `core-plugins/`, `plugins/`, `~/.mdevex/plugins/`, `$MDEVEX_EXTRA_PLUGIN_DIR`.
- Each plugin = dir with `plugin.json` + optional `server.js` (ES module) + optional `client.js` (IIFE).
- Server-side API: `pluginFn({ app, wss, eventBus, pluginDir, manifest })`. Events: `ws-connect`, `ws-data-in`, `ws-data-out`, `ws-disconnect`.
- Client-side API: `window.mdevex` — `on/off/emit`, `settings.get/set/registerSection`, `slots` (named DOM elements). Events: `session-changed`, `connected`, `disconnected`, `backend-data`, `terminal-data`, `resize`, `sessions-loaded`, `terminal-ready`, `init`.
- UI slots: `top-bar`, `toolbar-left/center/right`, `main`, `bottom-bar`, `overlay`, `settings-panel`.

## Key files

- `server.js` — Express + WebSocket upgrade + plugin loader + `/api/settings` endpoints.
- `public/index.html` — SPA shell, event bus, `window.mdevex` API, plugin loader, settings with localStorage + server sync.
- `core-plugins/tmux-backend/` — the actual tmux/PTY bridge (the reason this project needs `node-pty`).
- `core-plugins/xterm/` — loads xterm.js from CDN, creates Terminal per session.

## Conventions

- No build step. Vanilla JS, ES modules on server.
- Event-driven plugin communication, not RPC.
- Settings shared across plugins via `mdevex.settings`.
- Deps kept minimal: `express`, `node-pty`, `ws`, plus Playwright for tests.
