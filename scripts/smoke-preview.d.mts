import type { ChildProcess } from "node:child_process";

export type ChildExitOutcome =
  | { kind: "error"; error: Error }
  | { kind: "exit"; code: number | null; signal: NodeJS.Signals | null };

export interface ChildProcessWatcher {
  exit: Promise<ChildExitOutcome>;
  hasExited: () => boolean;
}

export function extractBuildResourceUrls(html: string, documentUrl: string): string[];
export function watchChildProcess(child: ChildProcess): ChildProcessWatcher;
export function waitForProcessReady<T>(
  readiness: Promise<T>,
  watcher: ChildProcessWatcher,
  label: string,
): Promise<T>;
export function stopChildProcess(
  child: ChildProcess,
  watcher: ChildProcessWatcher,
  options?: { graceMs?: number; label?: string },
): Promise<void>;
export function smokePreview(options?: { port?: number }): Promise<void>;
