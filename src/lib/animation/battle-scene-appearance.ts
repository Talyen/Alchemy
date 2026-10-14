export interface BattleSceneAppearance {
  readonly ambientColor: readonly [number, number, number];
  readonly ambientOpacity: number;
  readonly shadowOpacity: number;
}

export const NEUTRAL_BATTLE_SCENE_APPEARANCE: BattleSceneAppearance = {
  ambientColor: [128, 128, 128],
  ambientOpacity: 0,
  shadowOpacity: 0.3,
};

/** Input is the small, central playing-area crop, not the board's decorative frame. */
export function deriveBattleSceneAppearance(pixels: ArrayLike<number>): BattleSceneAppearance {
  const samples: Array<{ rgb: [number, number, number]; luminance: number }> = [];
  for (let index = 0; index + 3 < pixels.length; index += 4) {
    const rgb = [pixels[index]!, pixels[index + 1]!, pixels[index + 2]!] as [number, number, number];
    if (pixels[index + 3]! < 128 || rgb.some((value) => !Number.isFinite(value) || value < 0 || value > 255)) continue;
    const luminance = (rgb[0] * 0.2126 + rgb[1] * 0.7152 + rgb[2] * 0.0722) / 255;
    if (luminance > 0.04 && luminance < 0.94) samples.push({ rgb, luminance });
  }
  if (!samples.length) return NEUTRAL_BATTLE_SCENE_APPEARANCE;

  samples.sort((a, b) => a.luminance - b.luminance);
  const trim = Math.floor(samples.length * 0.1);
  const middle = samples.slice(trim, samples.length - trim);
  const average = [0, 0, 0];
  let luminance = 0;
  for (const sample of middle) {
    for (let channel = 0; channel < 3; channel++) average[channel]! += sample.rgb[channel]! / middle.length;
    luminance += sample.luminance / middle.length;
  }

  // Compress chroma around mid-gray so saturated or very dark boards cannot recolor the art strongly.
  const mean = (average[0]! + average[1]! + average[2]!) / 3;
  const chroma = Math.max(...average) - Math.min(...average);
  const chromaScale = Math.min(1, 36 / Math.max(chroma, 1));
  const ambientColor = average.map((value) => Math.round(140 + (value - mean) * chromaScale)) as [
    number,
    number,
    number,
  ];
  return {
    ambientColor,
    ambientOpacity: 0.06 * Math.min(1, chroma / 24),
    shadowOpacity: 0.26 + luminance * 0.12,
  };
}
