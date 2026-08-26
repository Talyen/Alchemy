# Bugbot review focus

Alchemy is trunk-based. Bugbot is a post-push review aid, not a required GitHub status check and not part of local `verify:changed` / `check:push`.

Prioritize:

- Save, hydrate, and migration paths (`shared/storage`, `src/lib/validation`, active-run session).
- Battle arithmetic and RNG injection (`src/lib/battle`).
- Run-session write ports vs direct store mutation.
- New `src/lib` file without a basename-mirrored unit test (`src/lib/battle/dot-resolve.ts` → `tests/lib/battle/dot-resolve.test.ts`).

Do not duplicate ESLint, import-boundary, or Prettier findings. Ignore generated asset barrels and committed optimized outputs.
