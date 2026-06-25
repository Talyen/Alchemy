# Game Feature UI Components

This directory contains game-specific, domain-aware UI components and reusable game widgets (e.g. cards, choice buttons, status icons, actor panels).

### Guidelines

- **Game Domain Components**: Keep components in this folder dedicated to visual representations of game concepts (combats, map nodes, shop slots, decks, homestead upgrades).
- **Zustand / State Boundaries**: Respect `eslint.config.js` boundaries. Reusable feature widgets here must receive their domain data via props rather than subscribing directly to run/battle/session stores (ui-store is allowed).
- **Generic Styling**: Visual primitives (e.g., standard layout buttons, progress bars, switch inputs) should be used from `src/components/ui/` instead of recreating them here.
