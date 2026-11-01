export interface PatchNoteCommit {
  subject: string;
  body: string;
  files?: string[];
}

export function buildPatchNotesMarkdown(tag: string, commits: PatchNoteCommit[], knownIssues?: string[]): string;

export function extractPlayerFacingLines(commit: PatchNoteCommit): string[];

export function isInfraPath(filePath: string): boolean;

export function isUserFacing(commit: PatchNoteCommit): boolean;

export function parseConventionalCommit(header: string): {
  type: string;
  scope: string | undefined;
  include: boolean;
};

export function userFacingTrailer(body: string): "yes" | "no" | null;
