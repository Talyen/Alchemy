export class UsageError extends Error {}

export function defineScript(importMetaUrl: string, fn: () => unknown, options?: { artifacts?: boolean }): void;

export function runPipelineScript(importMetaUrl: string, label: string, scriptFn: () => unknown): void;
