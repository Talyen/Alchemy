export interface PlaywrightDiagnosticInput {
  runId?: string;
  rootDir?: string;
  title: string;
  file: string;
  line?: number;
  project?: string;
  status: string | undefined;
  duration: number;
  url?: string;
  errorMessage?: string;
  logs?: string[];
  accessibilitySnapshot?: string;
  htmlFallback?: string;
}

export interface PlaywrightDiagnostic {
  runId: string;
  identity: { id: string; file: string; line: number; project: string; title: string };
  markdown: string;
  omittedLogs: number;
  omittedContextBytes: number;
  contextKind: "accessibility" | "html-fallback";
}

export const MAX_DIAGNOSTIC_BYTES: number;

export function diagnosticIdentity(input: {
  rootDir?: string;
  file: string;
  line?: number;
  project?: string;
  title: string;
}): PlaywrightDiagnostic["identity"];

export function failureDigestRelativePath(runId: string, diagnosticId: string): string;

export function buildFailureDiagnostic(
  input: PlaywrightDiagnosticInput,
  options?: { maxBytes?: number },
): PlaywrightDiagnostic;

export function writeFailureDiagnostic(
  rootDir: string,
  diagnostic: PlaywrightDiagnostic,
): { digestPath: string; recordPath: string };

export function writeFailureIndex(
  rootDir: string,
  runId?: string,
): {
  indexPath: string;
  failures: Array<{ id: string; runId: string; digestPath: string; bytes: number }>;
};
