export const GEAR_FILE_PATTERN: RegExp;

export const SLOT_BACKGROUND_PATTERN: RegExp;

export const GEAR_SLOT_IDS: readonly string[];

export const WEBP_SUFFIX: string;

export const GEAR_PREFIX: string;

export function slugifyGearName(name: string): string;

export function toGearTarget(displayName: string, rarity: string, extension?: string): string;

export function toDefinitionId(target: string): string;

export function isWebpAsset(name: string): boolean;

export function isGearAsset(name: string): boolean;

export function getAssetFiles(manifest: Record<string, unknown>): string[];

export function getGearFiles(manifest: Record<string, unknown>): string[];
