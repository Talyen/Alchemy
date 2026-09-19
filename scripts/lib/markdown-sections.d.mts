export function readDocumentSection(
  root: string,
  filename: string,
  heading?: string,
): { start: number; end: number; text: string };

export function headingSlugs(source: string): Set<string>;

export function stripFencedBlocks(source: string): string;

export function mapUnfencedLines(content: string, fn: (line: string) => string): string;

export function extractMarkdownLinkTargets(source: string): Array<{ target: string; index: number }>;

export function compactMarkdownTables(source: string): string;
export function sectionPreview(section: { path: string; text: string; start: number }): string[];
