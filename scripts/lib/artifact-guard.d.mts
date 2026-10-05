export function withArtifactGuard<T>(
  rootDir: string,
  operation: (state: { active: boolean; directory: string }) => T,
  options?: { dryRun?: boolean },
): Promise<T>;
export function registerArtifactSession(rootDir: string, prune?: () => void): Promise<() => void>;
