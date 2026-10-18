export interface BattleSceneAppearance {
  readonly ambientColor: readonly [number, number, number];
  readonly ambientOpacity: number;
  readonly shadowOpacity: number;
  readonly artworkExposure: number;
  readonly shadeOpacity: number;
}

export const NEUTRAL_BATTLE_SCENE_APPEARANCE: BattleSceneAppearance = {
  ambientColor: [128, 128, 128],
  ambientOpacity: 0,
  shadowOpacity: 0.3,
  artworkExposure: 1,
  shadeOpacity: 0,
};

/** Input is the small, central playing-area crop, not the board's decorative frame. */
export function deriveBattleSceneAppearance(pixels: ArrayLike<number>): BattleSceneAppearance {
  return appearanceFromSamples(collectSceneSamples(pixels));
}

interface SceneSample {
  rgb: [number, number, number];
  luminance: number;
}

function collectSceneSamples(pixels: ArrayLike<number>): SceneSample[] {
  const samples: SceneSample[] = [];
  for (let index = 0; index + 3 < pixels.length; index += 4) {
    const sample = toSceneSample(pixels[index]!, pixels[index + 1]!, pixels[index + 2]!, pixels[index + 3]!);
    if (sample) samples.push(sample);
  }
  return samples;
}

function toSceneSample(r: number, g: number, b: number, a: number): SceneSample | null {
  if (a < 128 || ![r, g, b].every((value) => Number.isFinite(value) && value >= 0 && value <= 255)) return null;
  const luminance = (r * 0.2126 + g * 0.7152 + b * 0.0722) / 255;
  if (luminance <= 0.04 || luminance >= 0.94) return null;
  return { rgb: [r, g, b], luminance };
}

function appearanceFromSamples(samples: SceneSample[]): BattleSceneAppearance {
  if (!samples.length) return NEUTRAL_BATTLE_SCENE_APPEARANCE;

  const ordered = [...samples].sort((a, b) => a.luminance - b.luminance);
  const trim = Math.floor(ordered.length * 0.1);
  const middle = ordered.slice(trim, ordered.length - trim);
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
    artworkExposure: Math.max(0.94, Math.min(1.03, 0.94 + luminance * 0.12)),
    shadeOpacity: Math.max(0.025, Math.min(0.08, 0.08 - luminance * 0.06)),
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
  const zones = collectZonedSceneSamples(pixels, width, height);
  const global = appearanceFromSamples(zones.global);
  if (global === NEUTRAL_BATTLE_SCENE_APPEARANCE) return NEUTRAL_BATTLE_SCENE_LIGHTING;
  function region(samples: SceneSample[]): BattleSceneAppearance {
    const local = appearanceFromSamples(samples);
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
      artworkExposure: (global.artworkExposure + local.artworkExposure) / 2,
      shadeOpacity: (global.shadeOpacity + local.shadeOpacity) / 2,
    };
  }
  return {
    ...global,
    regions: { left: region(zones.left), right: region(zones.right), lower: region(zones.lower) },
  };
}

/** One pass over the board crop buckets each kept sample into its soft zones. */
function collectZonedSceneSamples(
  pixels: ArrayLike<number>,
  width: number,
  height: number,
): Record<"global" | "left" | "right" | "lower", SceneSample[]> {
  const zones: Record<"global" | "left" | "right" | "lower", SceneSample[]> = {
    global: [],
    left: [],
    right: [],
    lower: [],
  };
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const index = (y * width + x) * 4;
      const sample = toSceneSample(pixels[index]!, pixels[index + 1]!, pixels[index + 2]!, pixels[index + 3]!);
      if (!sample) continue;
      zones.global.push(sample);
      if (x < width * 0.55 && y < height * 0.75) zones.left.push(sample);
      if (x >= width * 0.45 && y < height * 0.75) zones.right.push(sample);
      if (y >= height * 0.55) zones.lower.push(sample);
    }
  }
  return zones;
}
