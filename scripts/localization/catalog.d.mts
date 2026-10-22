export interface Message {
  plural?: boolean;
  forms?: Record<string, string>;
  text: string;
  context: string;
  terms?: readonly string[];
  aliasOf?: string;
  values?: Record<string, string | number>;
}
export interface Translation {
  forms?: Record<string, string>;
  text: string;
  sourceHash: string;
  reviewed: boolean;
}
export const INSTRUCTIONS: string;
export const TARGETS: string[];
export function digest(value: unknown): string;
export function ordered<T>(value: Record<string, T>): Record<string, T>;
export function parameters(value: string): string[];
export function tags(value: string): string[];
export function sourceHash(message: Message, glossary: Record<string, string>, locale: string): string;
export function validateTranslation(message: Pick<Message, "text">, value: string): void;
export function validateResults(input: {
  messages: Record<string, Message>;
  glossary: Record<string, string>;
  locale: string;
  results: Record<string, Translation>;
  previous?: Record<string, Translation>;
}): Record<string, Translation>;
export function resolveAliases(
  messages: Record<string, Message>,
  entries: Record<string, Translation>,
  glossary: Record<string, string>,
  locale: string,
): Record<string, Translation>;

export function validatePluralForms(message: Message, result: Translation, locale: string): void;

export function relatedTerms(
  text: string,
  terms: readonly string[],
  aliases?: ReadonlyArray<{ match: string; keywordId: string }>,
): string[];

interface WorkflowInput {
  messages: Record<string, Message>;
  glossary: Record<string, Record<string, string>>;
  catalogs: Record<string, Record<string, Translation>>;
}
export function translationPackets(
  input: WorkflowInput,
  drafts?: unknown,
): Array<{
  locale: string;
  instructions: string;
  glossary: Record<string, string>;
  messages: Record<string, Message & { sourceHash: string; previous: string | null }>;
  results: Record<string, Translation>;
}>;
export function validateBatch(input: unknown, context: WorkflowInput): Record<string, Record<string, Translation>>;
