// Viewport, Aspect Ratio, and Resolution hooks/helpers.
// Controls coordinate scaling mapping between virtual design stage and the physical screen.

import { useEffect, useState } from "react";
import { MAX_STAGE_SCALE, MIN_STAGE_SCALE, STAGE_HEIGHT } from "@/lib/game-constants";
import type { AspectRatioOption } from "./types";

/**
 * Centered Layout configurations and Aspect Ratio values.
 * Keeps preset coordinates and scaling multipliers grouped in one config block.
 */
const LAYOUT_CONFIG = {
  DEFAULT_WIDTH: 1920,
  DEFAULT_HEIGHT: 1080,
  NATIVE_RESOLUTION_SCALE_THRESHOLD: 1.5,
  STAGE_PIXEL_RATIO_DEFAULT: 1,
  STAGE_SCALE_DEFAULT: 1.0,
  ASPECT_RATIO_STAGE_SIZES: {
    "16:9": { width: 1920, height: 1080 },
    "16:10": { width: 1920, height: 1200 },
    "21:9": { width: 2560, height: 1080 },
  } as Record<Exclude<AspectRatioOption, "auto">, { width: number; height: number }>,
  PRESET_ASPECT_VALUES: {
    "16:9": 1920 / 1080,
    "16:10": 1920 / 1200,
    "21:9": 2560 / 1080,
  } as Record<Exclude<AspectRatioOption, "auto">, number>,
} as const;

/**
 * Resolves the closest preset aspect ratio based on the current physical viewport dimensions.
 */
export function resolveAutoAspectRatio(
  viewportWidth: number,
  viewportHeight: number,
): Exclude<AspectRatioOption, "auto"> {
  const viewportAspect = viewportWidth / viewportHeight;
  const aspectKeys = Object.keys(LAYOUT_CONFIG.PRESET_ASPECT_VALUES) as Array<Exclude<AspectRatioOption, "auto">>;
  return aspectKeys.reduce((best, key) =>
    Math.abs(viewportAspect - LAYOUT_CONFIG.PRESET_ASPECT_VALUES[key]) <
    Math.abs(viewportAspect - LAYOUT_CONFIG.PRESET_ASPECT_VALUES[best])
      ? key
      : best,
  );
}

/**
 * Custom hook to track the browser viewport dimensions reactively.
 */
function useViewportSize() {
  const [viewportSize, setViewportSize] = useState(() => ({
    width: typeof window !== "undefined" ? window.innerWidth : LAYOUT_CONFIG.DEFAULT_WIDTH,
    height: typeof window !== "undefined" ? window.innerHeight : LAYOUT_CONFIG.DEFAULT_HEIGHT,
  }));

  useEffect(() => {
    function handleResize() {
      setViewportSize({ width: window.innerWidth, height: window.innerHeight });
    }
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  return viewportSize;
}

/**
 * Determines target virtual stage dimensions based on the resolved aspect ratio option.
 */
function getVirtualStageDimensions(resolvedAspect: Exclude<AspectRatioOption, "auto">): {
  stageWidth: number;
  stageHeight: number;
} {
  const targetSize = LAYOUT_CONFIG.ASPECT_RATIO_STAGE_SIZES[resolvedAspect];
  return {
    stageWidth: Math.round(STAGE_HEIGHT * (targetSize.width / targetSize.height)),
    stageHeight: STAGE_HEIGHT,
  };
}

/**
 * Computes viewport fitting scale while clamping it to safe min/max ranges.
 */
function getStageScale(viewportWidth: number, viewportHeight: number, stageWidth: number, stageHeight: number): number {
  const viewportAspect = viewportWidth / viewportHeight;
  const stageAspect = stageWidth / stageHeight;
  const rawScale = viewportAspect > stageAspect ? viewportHeight / stageHeight : viewportWidth / stageWidth;
  return Math.max(MIN_STAGE_SCALE, Math.min(MAX_STAGE_SCALE, rawScale));
}

interface NativeResolutionResult {
  finalScale: number;
  finalStageWidth: number;
  finalStageHeight: number;
  stagePixelRatio: number;
}

/**
 * High-DPI optimization: For scales >= 1.5, we increase stage size natively
 * and set transform scale to 1.0 to preserve subpixel antialiasing/avoid blurriness.
 */
function optimizeForNativeResolution(
  scale: number,
  stageWidth: number,
  stageHeight: number,
  viewportWidth: number,
  viewportHeight: number,
): NativeResolutionResult {
  const nativeMultiplier = Math.round(scale);
  const useNativeResolution =
    scale >= LAYOUT_CONFIG.NATIVE_RESOLUTION_SCALE_THRESHOLD &&
    stageWidth * nativeMultiplier <= viewportWidth &&
    stageHeight * nativeMultiplier <= viewportHeight;

  if (useNativeResolution) {
    return {
      finalScale: LAYOUT_CONFIG.STAGE_SCALE_DEFAULT,
      finalStageWidth: stageWidth * nativeMultiplier,
      finalStageHeight: stageHeight * nativeMultiplier,
      stagePixelRatio: nativeMultiplier,
    };
  }

  return {
    finalScale: scale,
    finalStageWidth: stageWidth,
    finalStageHeight: stageHeight,
    stagePixelRatio: LAYOUT_CONFIG.STAGE_PIXEL_RATIO_DEFAULT,
  };
}

/**
 * Maps the resolved aspect ratio to standard, narrow, or ultrawide aspectModes.
 */
function getAspectMode(resolvedAspect: Exclude<AspectRatioOption, "auto">): "standard" | "narrow" | "ultrawide" {
  if (resolvedAspect === "16:10") {
    return "narrow";
  }
  if (resolvedAspect === "21:9") {
    return "ultrawide";
  }
  return "standard";
}

const BYPASS_RESOLUTION_RESULT = {
  frameStyle: { width: "100%", height: "100%" },
  stageStyle: { width: "100%", height: "100%", transform: "none", transformOrigin: "top left", left: 0, top: 0 },
  aspectMode: "standard" as const,
  stagePixelRatio: 1,
} as const;

/**
 * Hook to compute responsive CSS transform scaling style mappings, bounding boxes, and ratios
 * to fit a target game canvas size into the browser viewport size.
 */
export function useVirtualResolution(selectedAspectRatio: AspectRatioOption, bypassVr = false) {
  const { width, height } = useViewportSize();
  if (bypassVr) return BYPASS_RESOLUTION_RESULT;

  const resolvedAspect = selectedAspectRatio === "auto" ? resolveAutoAspectRatio(width, height) : selectedAspectRatio;

  const dims = getVirtualStageDimensions(resolvedAspect);
  const scale = getStageScale(width, height, dims.stageWidth, dims.stageHeight);
  const native = optimizeForNativeResolution(scale, dims.stageWidth, dims.stageHeight, width, height);

  const frameWidth = native.finalStageWidth * native.finalScale;
  const frameHeight = native.finalStageHeight * native.finalScale;

  return {
    frameStyle: { width: `${frameWidth}px`, height: `${frameHeight}px` },
    stageStyle: {
      width: `${native.finalStageWidth}px`,
      height: `${native.finalStageHeight}px`,
      transform: `scale(${native.finalScale})`,
      transformOrigin: "top left",
      left: 0,
      top: 0,
    },
    aspectMode: getAspectMode(resolvedAspect),
    stagePixelRatio: native.stagePixelRatio,
  };
}
