export function parseSyncArgs(argv: string[]): {
  check: boolean;
  gearOnly: boolean;
  artOnly: boolean;
  versionOnly: boolean;
};

export function syncGenerated(options?: {
  check?: boolean;
  artOnly?: boolean;
  gearOnly?: boolean;
  versionOnly?: boolean;
}): Promise<void>;
