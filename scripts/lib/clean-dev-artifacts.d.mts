export declare const TRANSIENT_ARTIFACT_DIRS: readonly string[];
export declare const DEFAULT_ARTIFACT_DIRS: readonly string[];
export declare const BUILD_ARTIFACT_DIRS: readonly string[];

export declare function listArtifactDirsToRemove(
  rootDir: string,
  options?: { builds?: boolean },
): string[];

export declare function measurePath(absolutePath: string): { path: string; bytes: number };
export declare function removePath(absolutePath: string): void;
export declare function formatBytes(bytes: number): string;
