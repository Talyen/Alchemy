export function assetGroup<Settings extends object>(
  options: { folder: string; settings: Settings; targetExtension?: string },
  selections: readonly (string | readonly [source: string, target: string, settings?: Partial<Settings>])[],
): Array<Settings & { source: string; target: string }>;
