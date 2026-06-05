---
name: Vite inline script esbuild transform
description: Vite dev mode runs esbuild on inline <script> tags, which can silently corrupt or reject valid browser JS (especially large minified/legacy code).
---

## Rule
Never put large vanilla JS game code (or any legacy non-module script) directly in an HTML `<script>` block when using Vite. Move it to `public/<name>.js` and reference it with `<script src="<name>.js"></script>`.

**Why:** Vite's HTML transform pipeline passes inline `<script>` content through esbuild even when the tag has no `type="module"`. For large minified files or code with patterns esbuild dislikes, this produces a `SyntaxError: Unexpected token` in the browser with no useful line info.

**How to apply:** When scaffolding a Vite artifact to host a self-contained HTML game or legacy JS page, always put the JS in `public/` from the start. Files in `public/` are copied byte-for-byte without any transform.
