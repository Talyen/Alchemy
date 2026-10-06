export function parseAssetArgs(argv: string[]): { help: boolean; check: boolean; mode: string; outputsOnly?: boolean };

export function runAssetCommand(options: {
  help: boolean;
  check: boolean;
  mode: string;
  outputsOnly?: boolean;
}): Promise<void>;
