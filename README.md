# Alchemy

A React + TypeScript card battler prototype.

## Development

- `npm run dev` — start dev server
- `npm run build` — type-check and production build

### UI Reliability Guardrails

- Rules: `docs/ui_rules.md`
- Contribution guide: `docs/ui_contributing.md`
- Primitive-first UI components: `src/ui/primitives`
- Runtime diagnostics (development): `src/ui/debug`
- Static guardrails (Vite plugin): `src/ui/guardrails/viteUiGuardrails.ts`

Enable UI debug overlays:

- Set `UI_DEBUG=true` (or `VITE_UI_DEBUG=true`) in `.env`
- Or use `Ctrl+Shift+U` while running the app

Run strict static UI checks:

- `npm run build:ui-strict` (fails build if guardrail violations exist)

Run responsive UI diagnostics regression:

- `npm run test:ui-guardrails`

Run visual QA capture + assertions:

- `npm run qa:visual`
- Report files: `screenshots/qa/report.md` and `screenshots/qa/report.json`
- Process details: `docs/ui_qa_process.md`

## Version Control Safety Policy

This project uses an automatic checkpoint workflow to reduce accidental loss.

- Create checkpoint commits during active development.
- Commit at milestones, before risky refactors, and after substantial accumulated changes.
- Push checkpoints to GitHub regularly, and always push at the end of a session.
- Temporary override: if the user says `no commit yet`, defer commits until re-enabled.
