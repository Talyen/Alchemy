import { useEffect, useState } from "react";

import {
  deriveBattleSceneLighting,
  NEUTRAL_BATTLE_SCENE_LIGHTING,
  type BattleSceneLighting,
} from "@/lib/animation/battle-scene-appearance";
import { waitForImage } from "@/lib/preload";

const appearances = new Map<string, Promise<BattleSceneLighting>>();
const MAX_CACHED_APPEARANCES = 128;

async function sampleBoard(source: string): Promise<BattleSceneLighting> {
  const image = new Image();
  image.decoding = "async";
  image.src = source;
  try {
    if (!(await waitForImage(image))) return NEUTRAL_BATTLE_SCENE_LIGHTING;
    const canvas = document.createElement("canvas");
    canvas.width = 32;
    canvas.height = 20;
    const context = canvas.getContext("2d", { willReadFrequently: true });
    if (!context) return NEUTRAL_BATTLE_SCENE_LIGHTING;
    context.drawImage(
      image,
      image.naturalWidth * 0.15,
      image.naturalHeight * 0.15,
      image.naturalWidth * 0.7,
      image.naturalHeight * 0.7,
      0,
      0,
      canvas.width,
      canvas.height,
    );
    return deriveBattleSceneLighting(
      context.getImageData(0, 0, canvas.width, canvas.height).data,
      canvas.width,
      canvas.height,
    );
  } catch {
    // Missing artwork, canvas restrictions, and decode failures retain neutral grounding.
    return NEUTRAL_BATTLE_SCENE_LIGHTING;
  } finally {
    image.removeAttribute("src");
  }
}

function loadAppearance(source: string): Promise<BattleSceneLighting> {
  let pending = appearances.get(source);
  if (!pending) {
    if (appearances.size >= MAX_CACHED_APPEARANCES) appearances.delete(appearances.keys().next().value!);
    pending = sampleBoard(source);
    appearances.set(source, pending);
  }
  return pending;
}

export function useBattleSceneAppearance(source: string | undefined): BattleSceneLighting {
  const [sample, setSample] = useState<{ source: string; appearance: BattleSceneLighting } | null>(null);
  useEffect(() => {
    if (!source) return;
    let current = true;
    void loadAppearance(source).then((appearance) => {
      if (current) setSample({ source, appearance });
    });
    return () => {
      current = false;
    };
  }, [source]);

  return source && sample?.source === source ? sample.appearance : NEUTRAL_BATTLE_SCENE_LIGHTING;
}
