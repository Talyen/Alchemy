export declare const ART_PRESETS: Readonly<Record<string, Readonly<{ width: number; quality: number }>>>;
export declare const GEAR_SLOT_IDS: readonly string[];
export declare const WIDTH: Readonly<Record<string, number>>;
export declare const QUALITY: Readonly<Record<string, number>>;
export declare const VALIDATION_CONCURRENCY: number;
export declare const MANAGED_DIRS: Readonly<
  Record<string, Readonly<{ dir: string; curatedExceptions: readonly string[] }>>
>;
export declare function artPreset(kind: string): Readonly<{ width: number; quality: number }>;
