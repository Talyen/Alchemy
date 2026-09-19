export class UsageError extends Error {}

export function defineScript(importMetaUrl: string, fn: () => unknown): void;

export function runPipelineScript(importMetaUrl: string, label: string, scriptFn: () => unknown): void;
