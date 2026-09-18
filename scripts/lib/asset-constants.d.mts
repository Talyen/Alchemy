export declare const ART_PRESETS: Readonly<Record<string, Readonly<{ width: number; quality: number }>>>;
export declare const WIDTH: Readonly<Record<string, number>>;
export declare const QUALITY: Readonly<Record<string, number>>;
export declare const VALIDATION_CONCURRENCY: number;
export declare function resolveAssetConcurrency(fallback: number): number;
export declare function soundTransformSettings(sourceExt: string): Readonly<Record<string, unknown>>;
export declare const MANAGED_DIRS: Readonly<Record<string, Readonly<{ dir: string }>>>;
