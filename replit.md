# Bleach: Soul Society Underground

A Bleach-themed metroidvania browser game — explore Soul Society, fight Hollows and Shinigami captains, unlock abilities, and challenge bosses across multiple areas.

## Run & Operate

- `pnpm --filter @workspace/bleach-game run dev` — run the game (port 25980, preview at `/`)
- `pnpm --filter @workspace/api-server run dev` — run the API server (port 8080)
- `pnpm run typecheck` — full typecheck across all packages

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- Game: vanilla HTML/CSS/JS (canvas-based), served via Vite as static files
- API: Express 5 (unused by game currently)

## Where things live

- `artifacts/bleach-game/index.html` — game HTML shell (CSS + DOM structure)
- `artifacts/bleach-game/public/game.js` — all game logic (served raw, no Vite transform)
- `artifacts/bleach-game/vite.config.ts` — Vite config (no React/Tailwind plugins)

## Architecture decisions

- Game JS lives in `public/game.js`, NOT as an inline `<script>` — Vite's esbuild transform on inline scripts causes a SyntaxError even for valid browser JS. Files in `public/` are served byte-for-byte without transformation.
- No React or Tailwind plugins in vite.config — the game is pure vanilla canvas JS.

## Bugs fixed from original source

1. `GS_SETTINGS` was `8`, colliding with `GS.BOSS_INTRO=8` → changed to `99`
2. `En` (enemy) constructor never initialized `this.jcd` (jump cooldown) → added `this.jcd=0;`
3. Boss intro ternary chain was missing its final `: ""` fallback on the Ulquiorra case → fixed

## User preferences

_Populate as you build — explicit user instructions worth remembering across sessions._

## Gotchas

- Game JS **must** stay in `public/game.js` (or another `public/` path). Moving it back inline or to `src/` will cause Vite/esbuild to mangle it.
- The game uses global variables throughout — it is not a module and cannot be `import`ed.
