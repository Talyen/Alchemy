# Bugbot review focus

Alchemy is trunk-based. Bugbot is a post-push review aid, not a required GitHub status check and not part of local `verify` / `check`.

Prioritize:

- Save, hydrate, and migration paths (`shared/storage`, `src/lib/validation`, active-run session).
- Battle arithmetic and RNG injection (`src/lib/battle`).
- Run-session write ports vs direct store mutation.
- Changed game behavior without a trustworthy regression assertion at its owning layer. Inspect existing consumer and integration tests before calling a gap; a matching test filename is neither required nor proof of coverage.

Do not duplicate ESLint, import-boundary, or Prettier findings. Skip routine generated bulk, but inspect relevant generated asset barrels and optimized outputs when investigating missing assets, incorrect mappings, or generation defects. Fix their authoring sources rather than hand-editing generated output.
