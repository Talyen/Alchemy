// Shared byte budgets for path selections. Same value, different meanings —
// keep them as distinct named exports so a future tune of one cannot silently
// retune the other.
//
// INLINE_ARGS_BYTES: check.mjs spills the selection to paths.json above this
// size to stay under platform CLI arg limits.
// RELATED_SELECTION_BYTES: change-routes.mjs falls back to full unit coverage
// (unit-all) above this size instead of shell-sized related batches.
export const INLINE_ARGS_BYTES = 8_000;
export const RELATED_SELECTION_BYTES = 8_000;
