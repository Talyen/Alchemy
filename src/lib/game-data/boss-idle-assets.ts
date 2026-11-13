export interface BossIdleClip {
  readonly variants: readonly [
    { readonly width: 640; readonly src: string },
    { readonly width: 1280; readonly src: string },
    { readonly width: 1920; readonly src: string },
  ];
}

// Eager URL imports register files without loading or decoding the videos.
const videos = import.meta.glob<string>("/src/assets/boss-idles/*.mp4", { eager: true, import: "default" });

// Explicit selection and order keep adding files from changing battle playback.
const clipCounts = {
  "forge-golem": 3,
  frostwarden: 3,
  "iron-bear": 3,
  "blight-treant": 3,
  "blood-countess": 5,
  seraph: 3,
  "stone-titan": 3,
} as const;

function clip(id: string, number: number): BossIdleClip {
  const name = `/src/assets/boss-idles/${id}-idle-${number}`;
  const source = (suffix: string) => {
    const src = videos[`${name}${suffix}.mp4`];
    if (!src) throw new Error(`Missing boss idle video: ${name}${suffix}.mp4`);
    return src;
  };
  return {
    variants: [
      { width: 640, src: source("-640") },
      { width: 1280, src: source("-1280") },
      { width: 1920, src: source("") },
    ],
  };
}

// Battle presentation only: these URLs never join the startup image preload set.
export const bossIdleClips: Readonly<Partial<Record<string, readonly BossIdleClip[]>>> = Object.fromEntries(
  Object.entries(clipCounts).map(([id, count]) => [
    id,
    Array.from({ length: count }, (_, index) => clip(id, index + 1)),
  ]),
);
