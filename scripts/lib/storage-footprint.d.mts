export interface StorageFootprint {
  bytes: number;
  files: number;
  sourceMaps: number;
  video: number;
  music: number;
  images: number;
  sounds: number;
  children: Record<string, number>;
}
export declare function measureStorage(root: string): StorageFootprint;
export declare function checkRendererStorage(
  root: string,
  budgets: Readonly<Record<"renderer" | "video" | "music" | "images" | "sounds", number>>,
): boolean;
