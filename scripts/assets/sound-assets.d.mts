export const generatedSoundAssets: Array<{ source: string; target: string }>;

export const curatedSoundFiles: string[];

export function validateSoundAssetRegistry(options?: { sourceDir?: string }): Promise<void>;
