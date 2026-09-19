export interface VerificationRoute {
  id: string;
  patterns: string[];
  commands: string[];
  unknown?: boolean;
}

export interface VerificationCommand {
  key: string;
  label: string;
  reason: string;
  command: string;
  args: string[];
}

export const SHARED_BUILD_PATTERNS: readonly string[];

export const ROUTES: readonly VerificationRoute[];

export function validateRouteCatalog(options?: { rootDir?: string }): string[];

export function resolveRoutes(paths: string[]): VerificationRoute[];

export function resolveRoutePlan(paths: string[]): {
  paths: string[];
  routes: VerificationRoute[];
  commands: VerificationCommand[];
};
