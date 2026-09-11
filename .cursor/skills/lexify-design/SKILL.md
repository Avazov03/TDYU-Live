---
name: lexify-design
description: >-
  Lexify landing and UI design rules. Use when editing the homepage hero,
  site sections, brand colors, typography, or marketing UI; when applying
  Taste / Vercel guidelines; or when verifying UI with browser or Playwright.
---

# Lexify Design

Read and follow `DESIGN.md` at the repo root before changing landing/UI.

## Musts

- Brand name **Lexify** is the hero-level signal (largest type).
- Do not invent new marketing copy unless asked — rearrange/size existing text.
- Confirm UI understanding before coding (workflow rule).
- After UI work: check `http://localhost:3000` (Cursor browser and/or `npm run test:e2e`).
- Do not auto commit/push/deploy — ask once; only when user says «qil».

## Tools map

| Tool | Use |
|---|---|
| Taste / Vercel guidelines | Quality bar for spacing, focus, motion, forms |
| Awesome DESIGN.md patterns | Linear/Vercel-like clarity; keep Lexify cinematic hero |
| Image → code | Match user screenshots; keep Lexify copy |
| Playwright | Repeatable smoke on landing |

## Hero layout

Huge **LEXIFY** → tag → lead → larger pill CTA(s). Full-bleed photo OK; no cards/badges in hero.
