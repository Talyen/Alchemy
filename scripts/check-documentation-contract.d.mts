export const DOCUMENTATION_CONTRACTS: ReadonlyArray<readonly [string, () => string[]]>;

export function checkLocalMarkdownLinks(): string[];

export function checkDocumentedNpmScripts(): string[];

export function checkMarkdownHeadingAnchors(): string[];

export function checkDurableDocumentReachability(rootDir?: string): string[];

export function checkSkillIndexCompleteness(): string[];

export function checkDocumentationContracts(): string[];

export function isHistoryOnlyDoc(relativePath: string): boolean;

export function isReachabilityExempt(relativePath: string): boolean;

export function reportDocumentationContracts(): boolean;
