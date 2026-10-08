/**
 * Canonical list of run-earned material grant sites: every
 * awardMaterialsDuringRun grant outside the write port lives in one of
 * these files. The architecture guard test enforces this list. The
 * `alchemy/no-run-earned-add-materials` lint owns the separate
 * stockpile-grant allowlist (write port, write/run-end.ts, gear meta-salvage).
 */
export const AWARD_MATERIALS_CALL_SITES = [
  "src/features/alchemy/run-loop/navigation/mystery-flow.ts",
  "src/features/alchemy/run-loop/run/reward-commands.ts",
  "src/features/alchemy/shared/stores/gear-session-command.ts",
] as const;
