export const DOCUMENTATION_CONTRACTS: ReadonlyArray<readonly [string, () => string[]]>;

export function checkLocalMarkdownLinks(): string[];

export function checkInlineRepositoryPaths(): string[];

export function checkBacktickedCurrentFileReferences(): string[];

export function checkDocumentedNpmScripts(): string[];

export function checkMarkdownHeadingAnchors(): string[];

export function checkDurableDocumentReachability(rootDir?: string): string[];

export function checkKnowledgeIndexCompleteness(): string[];

export function checkSkillIndexCompleteness(): string[];

export function checkDocumentationContracts(): string[];
