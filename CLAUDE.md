# Alchemy — Project Rules

## Always-On: UI/UX Discipline

These rules apply automatically to every UI task. Do not wait to be asked. Treat violations as bugs.

**Approved stack — no substitutions:**
- Animations → **Framer Motion** (`motion.*`, `AnimatePresence`, `variants`, `whileHover`, `whileTap`)
- Styling → **Tailwind CSS v4** (utility classes + `var(--color-*)` custom properties)
- Base components → **shadcn/ui** (check before building anything: Button, Badge, Dialog, Tooltip, Tooltip, Progress, Card)
- Icons → **Lucide React**
- Utilities → `cn()` from `@/lib/utils`

**Forbidden — never use these:**
- CSS `@keyframes`, `transition:`, `animation:` for motion
- `innerHTML`, `document.querySelector`, string templates
- Inline `style={{ transform: ... }}` or `style={{ animation: ... }}`
- Hand-built buttons, tooltips, dialogs when shadcn has them

**Every interactive element must have:**
- `whileHover` + `whileTap` (or Tailwind `hover:`/`active:` for simple cases)
- Smooth enter animation (`initial` / `animate`)
- Exit animation via `AnimatePresence` if it can disappear

**Before writing any UI code, check:**
1. Does shadcn have this component? → use it
2. Is this motion? → use Framer Motion
3. Is this layout/color/spacing? → use Tailwind

Full reference: `~/.claude/commands/ui-ux.md`

---

## Project Stack

- React 19 + Vite 6 + TypeScript (strict)
- Framer Motion 12
- Tailwind CSS v4 — config in `src/index.css` `@theme {}` block, NOT `tailwind.config.js`
- shadcn/ui — `npx shadcn@latest add <component>` — lands in `src/components/ui/`
- Path alias: `@/` → `src/`

## Commands

- `npm run dev` — dev server (Chrome)
- `npm run build` — type-check + build

## Version Control Safety Policy

- Default workflow: create automatic checkpoint commits during active development.
- Commit when any of the following is true:
  - A meaningful milestone is complete (feature, bugfix, UI pass).
  - Before risky refactors or broad multi-file edits.
  - A substantial amount of time or diff has accumulated in-session.
- Push checkpoints to GitHub regularly and always push at session end.
- Override phrase: if user says `no commit yet`, skip committing until explicitly re-enabled.

## File Structure

```
src/
  components/
    ui/        ← shadcn (don't edit directly — wrap)
    game/      ← game-specific components
  lib/utils.ts ← cn()
  types.ts     ← game types
  data.ts      ← cards, enemies
  combat.ts    ← pure game logic (no React)
  App.tsx
  main.tsx
  index.css    ← design tokens + tailwind
```

## Art Assets

- Currently using Lucide icons + styled divs as placeholders
- Will receive itch.io asset packs — integrate via standard `<img>` or sprite sheets
- When assets arrive: add to `public/assets/`, reference as `/assets/...`
- Keep art layer separate from UI logic — swap without touching game components
