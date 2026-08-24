export interface RunCounts {
  passed?: number;
  failed?: number;
  skipped?: number;
  flaky?: number;
}

export interface RunArtifact {
  path: string;
  role?: "primary" | "secondary";
}

export interface CurrentRunOptions {
  rootDir: string;
  runId?: string;
  status: string;
  command: string;
  artifacts?: Array<string | RunArtifact>;
  summary?: string;
  counts?: RunCounts;
  commit?: string | null;
}

export function normalizeRunId(value: unknown): string;
export function createRunId(label?: string, options?: { now?: Date; pid?: number; suffix?: string }): string;
export function ensureRunId(label?: string, env?: NodeJS.ProcessEnv): string;
export function changedGitPaths(rootDir: string): string[] | null;
export function writeCurrentRun(options: CurrentRunOptions): {
  jsonPath: string;
  markdownPath: string;
  runJsonPath: string;
  runMarkdownPath: string;
  runId: string;
};
