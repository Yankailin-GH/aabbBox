# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

AABB Toolbox — a mobile H5 "toolbox" web app (`frontend/`) plus a one-command deploy script. It is a single-page app with **no build step, no bundler, and no npm dependencies**. Vue 3 is loaded from a CDN at runtime; every script is a plain IIFE attaching globals to `window`. To preview, open `frontend/index.html` directly in a browser.

## Commands

There is no build, lint, or test tooling. The only operations are:

- **Preview locally** — open `frontend/index.html` in a browser (no server needed).
- **Syntax-check a JS file** — `node --check <path>` (the project uses this informally; there is no test suite).
- **Deploy** — `./deploy.sh` (from the repo root). It tars `frontend/`, uploads via `scp` to `39.106.75.206`, backs up the old `frontend/` to `frontend_backup_<timestamp>` on the server, swaps in the new one, then verifies the site returns HTTP 200.
  - `DEPLOY_PASS=<password> ./deploy.sh` to authenticate by password instead of SSH key.
  - Rollback = rename `frontend_backup_<timestamp>` back to `frontend` on the server.
- **Live URL** — `http://39.106.75.206:8082/aabbBox/` (nginx serves `/aabbBox/` as an alias to the `frontend/` directory; see `.nginx_8082_new.conf`).

## Architecture

The app is a hash-routed SPA that renders "tools" (utility widgets and games). The three files that define the whole system:

1. **`frontend/index.html`** — the shell. Hard-links every tool's CSS and JS with `<link>`/`<script>` tags, then loads Vue from `https://unpkg.com/vue@3/dist/vue.global.prod.js`, then `src/tools/index.js`, then `src/main.js`. Adding a tool requires a new line here.
2. **`frontend/src/main.js`** — the Vue root. Reads the hash (`#/tools/<id>`), looks up the matching entry in `window.ToolboxTools`, and mounts either the home grid or the active tool's component. Tracks "recently used" in `localStorage` under the key `aabb-toolbox-recent`.
3. **`frontend/src/tools/index.js`** — the tool registry, an array assigned to `window.ToolboxTools`. Each entry: `{ id, name, desc, category, icon, theme, url, component, enabled }`. `component` points at a global like `global.ScoreboardTool`; `enabled: false` shows a "coming soon" placeholder.

### Tool pattern

Each tool lives in `frontend/src/tools/<name>/` as a `component.js` + `style.css`. `component.js` is an IIFE that defines a global Vue component (`window.XxxTool`) with `props: { tool }`, `emits: ["go-home"]`, and a `template` + `setup()`. It must also be linked in `index.html` and registered in `tools/index.js` (see `README.md` for the exact snippet).

`frontend/src/tools/mini-tools/component.js` is an exception — it bundles many tiny tools (color picker, JWT decode, Base64, pomodoro, etc.) as separate globals in one file, rather than one directory per tool.

### Games

There are two game patterns, both rendered inside the toolbox as iframes:

- **Arcade games** — `abyss-salvage`, `wasteland-convoy`, `sky-bastion`, `shadow-infiltration`, `core-forge`. Each is a **standalone HTML file** at `frontend/src/<name>.html` that calls `ArcadeKit.mount(config)`. The shared engine `frontend/src/arcade/arcade-kit.js` provides the canvas render loop, HUD, pointer/keyboard input, audio (`api.tone`), and lifecycle (start/pause/resume/finish). A game supplies `config = { title, colors, choices, init, resize, update, draw, pointerDown, action, ... }`; `update(api, dt)` / `draw(api)` are the core hooks, and the `api` object exposes `w/h`, `elapsed`, `choice`, `clamp/rand/distance/formatTime`, `setHud`, `setAction`, `finish`, `hit`, `tone`, `vibrate`, `freeze/unfreeze`. These are surfaced in the toolbox by `frontend/src/tools/arcade-games/component.js` (`ArcadeGameTool`), whose `games` map must list each new game.
- **`core-breach-game` / `core-breach-legacy`** — a separate survival game (`src/core-breach-game.html`) and its tower-defense legacy variant (`src/core-breach-legacy.html`), each with its own component (`frontend/src/tools/core-breach-game/component.js` defines `CoreBreachGameTool` and `LegacyCoreBreachGameTool`) that loads the HTML in an iframe.

The standalone game HTML files double as PWAs with their own `manifest.json` (`frontend/src/manifest.json`, `frontend/src/legacy-manifest.json`), independent of the toolbox shell.

## Conventions

- No ES modules — every file is an IIFE `(function (global) { ... })(window)` attaching to `global`.
- No framework state management — plain Vue `ref`/`computed` inside `setup()`.
- UI text and comments are written in Chinese; keep that when adding new strings.
- `git` user is `yankailin`; branch is `main`.
