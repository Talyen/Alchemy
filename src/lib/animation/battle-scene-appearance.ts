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
  const ambientColor = boundAmbientColor(average.map((value) => 140 + (value - mean) * chromaScale));
  return {
    ambientColor,
    ambientOpacity: 0.06 * Math.min(1, chroma / 24),
    shadowOpacity: 0.26 + luminance * 0.12,
  };
}

function boundAmbientColor(channels: readonly number[]): [number, number, number] {
  const rounded = channels.map(Math.round);
  const minimum = Math.min(...rounded);
  return rounded.map((value) => Math.min(value, minimum + 36)) as [number, number, number];
}

export interface BattleSceneLighting extends BattleSceneAppearance {
  readonly regions: Readonly<Record<"left" | "right" | "lower", BattleSceneAppearance>>;
}

export const NEUTRAL_BATTLE_SCENE_LIGHTING: BattleSceneLighting = {
  ...NEUTRAL_BATTLE_SCENE_APPEARANCE,
  regions: {
    left: NEUTRAL_BATTLE_SCENE_APPEARANCE,
    right: NEUTRAL_BATTLE_SCENE_APPEARANCE,
    lower: NEUTRAL_BATTLE_SCENE_APPEARANCE,
  },
};

/** Broad object zones, deliberately softened toward the whole board to avoid local color casts. */
export function deriveBattleSceneLighting(
  pixels: ArrayLike<number>,
  width: number,
  height: number,
): BattleSceneLighting {
  if (
    !Number.isSafeInteger(width) ||
    !Number.isSafeInteger(height) ||
    width < 1 ||
    height < 1 ||
    width * height * 4 !== pixels.length
  ) {
    return NEUTRAL_BATTLE_SCENE_LIGHTING;
  }
  const global = deriveBattleSceneAppearance(pixels);
  const zones: Record<"left" | "right" | "lower", number[]> = { left: [], right: [], lower: [] };
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const index = (y * width + x) * 4;
      const pixel = [pixels[index]!, pixels[index + 1]!, pixels[index + 2]!, pixels[index + 3]!];
      if (x < width * 0.55 && y < height * 0.75) zones.left.push(...pixel);
      if (x >= width * 0.45 && y < height * 0.75) zones.right.push(...pixel);
      if (y >= height * 0.55) zones.lower.push(...pixel);
    }
  }
  function region(input: number[]): BattleSceneAppearance {
    const local = deriveBattleSceneAppearance(input);
    if (local === NEUTRAL_BATTLE_SCENE_APPEARANCE) return global;
    // Blend premultiplied tint so a neutral region cannot invent a hue.
    const opacity = (global.ambientOpacity + local.ambientOpacity) / 2;
    return {
      ambientColor: boundAmbientColor(
        global.ambientColor.map((value, channel) =>
          opacity > 0
            ? (value * global.ambientOpacity + local.ambientColor[channel]! * local.ambientOpacity) / (2 * opacity)
            : value,
        ),
      ),
      ambientOpacity: opacity,
      shadowOpacity: global.shadowOpacity,
    };
  }
  return { ...global, regions: { left: region(zones.left), right: region(zones.right), lower: region(zones.lower) } };
}
