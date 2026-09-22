import type { VerificationCommand } from "./verification/change-routes.mjs";
export function summarizeStepResult(
  command: VerificationCommand,
  result: { output?: unknown; status?: number | null; elapsedMs?: number },
  options?: { verbose?: boolean },
): {
  exposure: {
    key: string;
    label: string;
    command: string;
    overBudget: boolean;
  };
  failureOutput: string;
};
