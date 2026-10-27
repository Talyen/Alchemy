export interface BuildAttempt {
  version: number;
  id: string;
  kind: "build" | "package";
  target: string;
  started: number;
  state: string;
  eligible: boolean;
  staging?: string;
}
export function beginBuildAttempt(
  root: string,
  options: { kind: "build" | "package"; target: string; eligible?: boolean; now?: number },
): BuildAttempt;
export function finishBuildAttempt(root: string, attempt: BuildAttempt, success: boolean, now?: number): void;
export function promotePackageAttempt(root: string, attempt: BuildAttempt): void;
export function protectPackageAttempts(root: string, target: string): void;
export function pruneFailedBuilds(
  root: string,
  options?: { dryRun?: boolean; now?: number },
): Array<{ path: string; bytes: number }>;
