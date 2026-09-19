export function parseAssetArgs(argv: string[]): { help: boolean; check: boolean; mode: string };

export function runAssetCommand(options: { help: boolean; check: boolean; mode: string }): Promise<void>;
