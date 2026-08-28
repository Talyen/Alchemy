import { useEffect, useRef, useState, type RefObject } from "react";
import { MAX_STAGE_SCALE, MIN_STAGE_SCALE, STAGE_HEIGHT } from "@/lib/game-constants";
import type { AspectRatioOption } from "./types";

const LAYOUT_CONFIG = {
  DEFAULT_WIDTH: 1920,
  DEFAULT_HEIGHT: 1080,
  STAGE_PIXEL_RATIO_DEFAULT: 1,
  ASPECT_RATIO_STAGE_SIZES: {
    "16:9": { width: 1920, height: 1080 },
    "16:10": { width: 1920, height: 1200 },
    "21:9": { width: 2560, height: 1080 },
  } as Record<Exclude<AspectRatioOption, "auto">, { width: number; height: number }>,
} as const;

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

function getStageScale(viewportWidth: number, viewportHeight: number, stageWidth: number, stageHeight: number): number {
  const availableWidth = Math.max(0, viewportWidth);
  const availableHeight = Math.max(0, viewportHeight);
  const viewportAspect = availableWidth / availableHeight;
  const stageAspect = stageWidth / stageHeight;
  const rawScale = viewportAspect > stageAspect ? availableHeight / stageHeight : availableWidth / stageWidth;
  return Math.max(MIN_STAGE_SCALE, Math.min(MAX_STAGE_SCALE, rawScale));
}

function getAspectModeFromRatio(aspectRatio: number): "standard" | "narrow" | "ultrawide" {
  if (aspectRatio < 1.68) {
    return "narrow";
  }
  if (aspectRatio > 2.05) {
    return "ultrawide";
  }
  return "standard";
}

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
  const availableWidth = Math.max(0, viewportWidth);
  const availableHeight = Math.max(0, viewportHeight);

  if (selectedAspectRatio === "auto") {
    const viewportAspect = availableHeight > 0 ? availableWidth / availableHeight : 16 / 9;
    const stageWidth = Math.round(STAGE_HEIGHT * viewportAspect);
    const stageHeight = STAGE_HEIGHT;
    const rawScale = availableHeight > 0 ? availableHeight / STAGE_HEIGHT : 1;
    const scale = Math.max(MIN_STAGE_SCALE, Math.min(MAX_STAGE_SCALE, rawScale));

    const frameWidth = availableWidth;
    const frameHeight = availableHeight;

    return {
      frameStyle: { width: `${frameWidth}px`, height: `${frameHeight}px` },
      stageStyle: {
        width: `${stageWidth}px`,
        height: `${stageHeight}px`,
        transform: `scale(${scale})`,
        transformOrigin: "top left",
        left: 0,
        top: 0,
      },
      aspectMode: getAspectModeFromRatio(viewportAspect),
      stagePixelRatio: LAYOUT_CONFIG.STAGE_PIXEL_RATIO_DEFAULT,
    };
  }

  const dims = getVirtualStageDimensions(selectedAspectRatio);
  const scale = getStageScale(availableWidth, availableHeight, dims.stageWidth, dims.stageHeight);
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
    aspectMode: getAspectMode(selectedAspectRatio),
    stagePixelRatio: LAYOUT_CONFIG.STAGE_PIXEL_RATIO_DEFAULT,
  };
}

export function useVirtualResolution(selectedAspectRatio: AspectRatioOption, bypassVr = false) {
  const { width, height } = useViewportSize(!bypassVr);
  if (bypassVr) return BYPASS_RESOLUTION_RESULT;
  return getVirtualResolutionLayout(selectedAspectRatio, width, height);
}

export function useLatestRef<T>(value: T): RefObject<T> {
  const valueRef = useRef(value);

  // eslint-disable-next-line react-hooks/refs -- latest-ref contract; not a render input
  valueRef.current = value;
  return valueRef;
}
