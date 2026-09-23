export interface PatchNoteCommit {
  subject: string;
  body: string;
  files?: string[];
}

export function buildChangelogUnreleased(commits: Array<{ subject: string; body: string }>): string;

export function buildPatchNotesMarkdown(tag: string, commits: PatchNoteCommit[], knownIssues?: string[]): string;

export function extractChangelogSection(content: string, heading: string): string;

export function extractPlayerFacingLines(commit: PatchNoteCommit): string[];

export function isInfraPath(filePath: string): boolean;

export function isProductPath(filePath: string): boolean;

export function isUserFacing(commit: PatchNoteCommit): boolean;

export function parseChangelogCommits(section: string): Array<{ subject: string; body: string }>;

export function parseConventionalCommit(header: string): {
  type: string;
  scope: string | undefined;
  include: boolean;
};

export function promoteUnreleasedSection(source: string, version: string, date: string): string;

export function replaceChangelogUnreleased(source: string, newSection: string): string;

export function userFacingTrailer(body: string): "yes" | "no" | null;
