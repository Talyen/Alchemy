export const GEAR_FILE_PATTERN: RegExp;

export const SLOT_BACKGROUND_PATTERN: RegExp;

export const GEAR_SLOT_IDS: readonly string[];

export function slugifyGearName(name: string): string;

export function toGearTarget(displayName: string, rarity: string, extension?: string): string;

export function isWebpAsset(name: string): boolean;

export function getAssetFiles(manifest: Record<string, unknown>): string[];
