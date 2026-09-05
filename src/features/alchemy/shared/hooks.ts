import { useEffect, useRef, useState, type RefObject } from "react";
import { STAGE_HEIGHT } from "@/lib/game-constants";
import { DEFAULT_DEVICE_DISPLAY, normalizeDisplayPercent, type DeviceDisplayPreferences } from "@/lib/settings-values";
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

const MAX_CONTENT_SCALE = 1.75;
const CONTENT_GROWTH_EXPONENT = 0.8;

export function getVirtualResolutionLayout(
  selectedAspectRatio: AspectRatioOption,
  viewportWidth: number,
  viewportHeight: number,
  preferences: DeviceDisplayPreferences = DEFAULT_DEVICE_DISPLAY,
) {
  const width = Number.isFinite(viewportWidth) ? Math.max(0, viewportWidth) : 0;
  const height = Number.isFinite(viewportHeight) ? Math.max(0, viewportHeight) : 0;
  const viewportAspect = width > 0 && height > 0 ? width / height : 16 / 9;
  const { stageWidth, stageHeight } =
    selectedAspectRatio === "auto"
      ? { stageWidth: STAGE_HEIGHT * viewportAspect, stageHeight: STAGE_HEIGHT }
      : getVirtualStageDimensions(selectedAspectRatio);
  const stageScale = Math.min(width / stageWidth, height / stageHeight);
  const automaticScale =
    stageScale <= 1 ? stageScale : Math.min(MAX_CONTENT_SCALE, stageScale ** CONTENT_GROWTH_EXPONENT);
  const contentScale = automaticScale * (normalizeDisplayPercent("gameSizePercent", preferences.gameSizePercent) / 100);
  const stageContentScale = stageScale > 0 ? contentScale / stageScale : 1;
  const tooltipScale = normalizeDisplayPercent("tooltipSizePercent", preferences.tooltipSizePercent) / 100;

  return {
    frameStyle: {
      width: `${stageWidth * stageScale}px`,
      height: `${stageHeight * stageScale}px`,
      "--content-scale": contentScale,
    },
    stageStyle: {
      width: `${stageWidth}px`,
      height: `${stageHeight}px`,
      transform: `scale(${stageScale})`,
      transformOrigin: "top left",
      left: 0,
      top: 0,
      "--content-scale": stageContentScale,
    },
    tooltipStyle: { "--content-scale": tooltipScale } as React.CSSProperties,
    aspectMode:
      selectedAspectRatio === "auto" ? getAspectModeFromRatio(viewportAspect) : getAspectMode(selectedAspectRatio),
    stagePixelRatio: LAYOUT_CONFIG.STAGE_PIXEL_RATIO_DEFAULT,
    stageScale,
    contentScale,
    stageContentScale,
    tooltipScale,
  };
}

export function useVirtualResolution(
  selectedAspectRatio: AspectRatioOption,
  bypassVr = false,
  preferences: DeviceDisplayPreferences = DEFAULT_DEVICE_DISPLAY,
) {
  const { width, height } = useViewportSize(!bypassVr);
  const layout = getVirtualResolutionLayout(selectedAspectRatio, width, height, preferences);
  if (!bypassVr) return layout;
  return {
    ...layout,
    frameStyle: { ...layout.frameStyle, width: "100%", height: "100%" },
    stageStyle: { ...layout.stageStyle, width: "100%", height: "100%", transform: "none" },
  };
}

export function useLatestRef<T>(value: T): RefObject<T> {
  const valueRef = useRef(value);

  // eslint-disable-next-line react-hooks/refs -- latest-ref contract; not a render input
  valueRef.current = value;
  return valueRef;
}
