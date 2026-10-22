export const RECEIPT: string;
export function requiresVisualReview(file: string): boolean;
export function visualSourceDigest(root: string): string;
export function validateVisualReview(root: string, paths: readonly string[], receipt: unknown): Promise<void>;
export function runVisualReview(argv: string[], root?: string): Promise<void>;
