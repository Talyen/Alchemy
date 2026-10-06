export interface MusicAssetEntry {
  source: string;
  target: string;
}

export function validateMusicRegistry<T extends string | MusicAssetEntry>(files: T[]): Promise<T[]>;

export const musicAssets: MusicAssetEntry[];
