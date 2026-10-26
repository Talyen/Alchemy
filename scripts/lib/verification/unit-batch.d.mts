import type { VerificationCommand, VerificationRoute } from "./change-routes.mjs";
export function batchUnitCommands(plan: {
  paths: string[];
  routes: VerificationRoute[];
  commands: VerificationCommand[];
}): { paths: string[]; routes: VerificationRoute[]; commands: VerificationCommand[] };
