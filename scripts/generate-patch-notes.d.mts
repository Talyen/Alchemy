import type { PatchNoteCommit } from "./lib/release/patch-notes-core.mjs";
export function parseGeneratePatchNotesArgs(
  argv: string[],
  env?: NodeJS.ProcessEnv,
): { dryRun: boolean; releaseVersion: string };

export function generatePatchNotesMarkdown(
  rootDir: string,
  options?: { releaseVersion?: string },
): { version: string; outputName: string; commits: PatchNoteCommit[]; markdown: string };
