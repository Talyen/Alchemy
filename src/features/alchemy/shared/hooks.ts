// Viewport, Aspect Ratio, and Resolution hooks/helpers.
// Controls coordinate scaling mapping between virtual design stage and the physical screen.

import { useEffect, useRef, useState, type RefObject } from "react";
import { MAX_STAGE_SCALE, MIN_STAGE_SCALE, STAGE_HEIGHT } from "@/lib/game-constants";
import type { AspectRatioOption } from "./types";

/**
 * Centered Layout configurations and Aspect Ratio values.
 * Keeps preset coordinates and scaling multipliers grouped in one config block.
 */
const LAYOUT_CONFIG = {
  DEFAULT_WIDTH: 1920,
  DEFAULT_HEIGHT: 1080,
  STAGE_PIXEL_RATIO_DEFAULT: 1,
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
 * Resolves the closest preset aspect ratio based on the current CSS viewport dimensions.
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
function useViewportSize(active: boolean) {
  const [viewportSize, setViewportSize] = useState(() => ({
    width: typeof window !== "undefined" ? window.innerWidth : LAYOUT_CONFIG.DEFAULT_WIDTH,
    height: typeof window !== "undefined" ? window.innerHeight : LAYOUT_CONFIG.DEFAULT_HEIGHT,
  }));

  useEffect(() => {
    if (!active) return;
    let frameId: number | null = null;

    function handleResize() {
      if (frameId !== null) return;
      frameId = window.requestAnimationFrame(() => {
        frameId = null;
        const width = window.innerWidth;
        const height = window.innerHeight;
        setViewportSize((current) =>
          current.width === width && current.height === height ? current : { width, height },
        );
      });
    }
    window.addEventListener("resize", handleResize);
    return () => {
      window.removeEventListener("resize", handleResize);
      if (frameId !== null) window.cancelAnimationFrame(frameId);
    };
  }, [active]);

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
 * Fits the full CSS viewport — leftover space letterboxes via centered layout,
 * so a native-size window stays at scale 1 instead of permanently downscaling.
 */
function getStageScale(viewportWidth: number, viewportHeight: number, stageWidth: number, stageHeight: number): number {
  const availableWidth = Math.max(0, viewportWidth);
  const availableHeight = Math.max(0, viewportHeight);
  const viewportAspect = availableWidth / availableHeight;
  const stageAspect = stageWidth / stageHeight;
  const rawScale = viewportAspect > stageAspect ? availableHeight / stageHeight : availableWidth / stageWidth;
  return Math.max(MIN_STAGE_SCALE, Math.min(MAX_STAGE_SCALE, rawScale));
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

export function getVirtualResolutionLayout(
  selectedAspectRatio: AspectRatioOption,
  viewportWidth: number,
  viewportHeight: number,
) {
  const resolvedAspect =
    selectedAspectRatio === "auto" ? resolveAutoAspectRatio(viewportWidth, viewportHeight) : selectedAspectRatio;
  const dims = getVirtualStageDimensions(resolvedAspect);
  const scale = getStageScale(viewportWidth, viewportHeight, dims.stageWidth, dims.stageHeight);
  const frameWidth = dims.stageWidth * scale;
  const frameHeight = dims.stageHeight * scale;

  return {
    frameStyle: { width: `${frameWidth}px`, height: `${frameHeight}px` },
    stageStyle: {
      width: `${dims.stageWidth}px`,
      height: `${dims.stageHeight}px`,
      transform: `scale(${scale})`,
      transformOrigin: "top left",
      left: 0,
      top: 0,
    },
    aspectMode: getAspectMode(resolvedAspect),
    stagePixelRatio: LAYOUT_CONFIG.STAGE_PIXEL_RATIO_DEFAULT,
  };
}

/**
 * Hook to compute responsive CSS transform scaling style mappings, bounding boxes, and ratios
 * to fit a target game canvas size into the browser viewport size.
 */
export function useVirtualResolution(selectedAspectRatio: AspectRatioOption, bypassVr = false) {
  const { width, height } = useViewportSize(!bypassVr);
  if (bypassVr) return BYPASS_RESOLUTION_RESULT;
  return getVirtualResolutionLayout(selectedAspectRatio, width, height);
}

/** Keeps the latest value available to stable event handlers without changing their identity. */
export function useLatestRef<T>(value: T): RefObject<T> {
  const valueRef = useRef(value);
  useEffect(() => {
    valueRef.current = value;
  }, [value]);
  return valueRef;
}
