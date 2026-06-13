# Bleach: Soul Society Underground — Codebase Analysis Complete

I've thoroughly analyzed the entire codebase and saved my full report to `project_info__1.md`. Here's what I found:

## Project Structure
This is a **single-file 2D Metroidvania** — the entire game lives in `artifacts/bleach-game/public/game.js` (~7000+ lines of vanilla JavaScript). It renders on an HTML5 Canvas with procedural pixel art (no spritesheets — everything is drawn with `fillRect` calls), Web Audio API procedural SFX, and hand-crafted room tile maps.

## Root Causes of the Issues You Mentioned

**Enemy glitching** — The primary cause is that enemy spawns are placed too close to walls/pits, and the `En.resFull()` collision resolution has no safety margin against wall clipping after knockback. Here's the exact fix locations:

| Issue | File Location | Fix |
|-------|--------------|-----|
| **r3 (Yoruichi) glitch** | `RM['r3'].enemies` | Move fly x:35→x:30, hollow x:38→x:34 — keep them 3+ tiles from walls |
| **s1 (Seireitei) door guard** | `RM['s1'].enemies` | Move guard x:5→x:9 (left wall), guard x:14→x:20 (entrance) |
| **s2 (Inner) entrance guard** | `RM['s2'].enemies` | Move guard x:4→x:9 (2 tiles from entrance — way too close), reposition guards away from columns at x:10,20,29 |
| **r2 Rukia too close** | `RM['r2'].npcs` | Rukia at x:17 — player enters at x:17! Move to x:7 |
| **h2 Nel + save point overlap** | `RM['h2']` | Both Nel NPC and save point at x:4,y:13. Separate them by 6+ tiles |
| **r3 chest reachable from below** | `RM['r3'].tiles` | Chest at x:41,y:9. Add solid tiles (type 1) at rows 11-14, x:41-43 beneath the alcove |

**Bosses can be hit before cutscene** — In the `combat()` function, the boss hitbox check doesn't verify `boss.active`. Add `&&boss.active` to the condition.

**L-attack (Getsuga/Cero) too strong** — Getsuga does 15 dmg, Cero does 12 dmg. Reduce both to 8 base. Getsuga lifetime: 40→28 frames. Cero lifetime: 60→35 frames. Both changes are in `P.update()`.

**Reiatsu passive regen + charge** — Delete the `fr%180===0` passive regen line AND the entire `if(IN.held('charge')...)` block in `P.update()`.

**Hollow mask not visible** — The mask drawing code EXISTS in `drIchigo()` but covers only a small left-side fragment. It needs to be enlarged/redesigned.

**Audio for Bankai/Hollow screams** — Currently uses procedural synth sounds. To add real audio, you'll need `<audio>` elements or `decodeAudioData()` in the Audio init. Audio files must be sourced manually from YouTube (I can't download them for you).

**Bleach-themed UI** — The HUD is in the `dHUD()` function. A CRT retro screen overlay would go in the CSS in `index.html`.

## What You Need To Do Now

I'm in **Explore Mode** — I can only analyze and document. To implement these fixes:

1. **Switch to Act Mode** using the mode selector at the bottom of the chat
2. All my findings and exact fix locations will carry over as context
3. The full detailed report is saved at `project_info__1.md` in the project root

Everything you need to fix is in ONE file: `artifacts/bleach-game/public/game.js`. Each fix location is precisely documented in my report.