export function readDocumentSection(
  root: string,
  filename: string,
  heading?: string,
): { start: number; end: number; text: string };

export function headingSlugs(source: string): Set<string>;

export function stripFencedBlocks(source: string): string;

export function extractMarkdownLinkTargets(source: string): Array<{ target: string; index: number }>;
