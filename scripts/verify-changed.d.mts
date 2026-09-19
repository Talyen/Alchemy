import type { VerificationRoute } from "./lib/change-routes.mjs";
import type { VerificationCommand } from "./lib/change-routes.mjs";
export function main(argv?: string[]): number;

export function parseVerifyArgs(argv: string[]): { flags: Set<string>; paths: string[] };

export function filterPlanCommands(
  plan: { paths: string[]; routes: VerificationRoute[]; commands: VerificationCommand[] },
  flags: Set<string>,
): { paths: string[]; routes: VerificationRoute[]; commands: VerificationCommand[] };

export function formatPlan(
  plan: { paths: string[]; routes: VerificationRoute[]; commands: VerificationCommand[] },
  options?: { verbosePlan?: boolean },
): string;
