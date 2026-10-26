import type { VerificationClassification, resolveRoutePlan } from "./change-routes.mjs";
export interface CheckStep {
  key: string;
  label: string;
  command: string;
  args: string[];
  enabled: boolean;
  reason?: string | undefined;
}
export function resolveCheckPlan(
  paths: string[],
  options: {
    rootDir: string;
    full?: boolean;
    prePush?: boolean;
    skipBuilds?: boolean;
    verifyArgs?: string[];
  },
): {
  paths: string[];
  verifyArgs: string[];
  selection: VerificationClassification;
  coverage: ReturnType<typeof resolveRoutePlan>;
  steps: CheckStep[];
};
