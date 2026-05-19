import { useCallback, useEffect, useRef, useState } from "react";
import {
  DESIGN_STAGE_HEIGHT,
  MAX_STAGE_SCALE,
  MIN_STAGE_SCALE,
  MOBILE_LANDSCAPE_MAX_WIDTH,
  MOBILE_STAGE_HEIGHT,
  ORIENTATION_CHANGE_DEBOUNCE_MS,
  PORTRAIT_MOBILE_MAX_WIDTH,
  SHIMMER_COOLDOWN_MS,
} from "@/lib/game-constants";
import type { AspectRatioOption } from "./types";

const ASPECT_RATIO_STAGE_SIZES: Record<Exclude<AspectRatioOption, "auto">, { width: number; height: number }> = {
  "16:9": { width: 1920, height: 1080 },
  "16:10": { width: 1920, height: 1200 },
  "21:9": { width: 2560, height: 1080 },
};

const PRESET_ASPECT_VALUES: Record<Exclude<AspectRatioOption, "auto">, number> = {
  "16:9": 1920 / 1080,
  "16:10": 1920 / 1200,
  "21:9": 2560 / 1080,
};

export function resolveAutoAspectRatio(
  viewportWidth: number,
  viewportHeight: number,
): Exclude<AspectRatioOption, "auto"> {
  const viewportAspect = viewportWidth / viewportHeight;
  return (Object.keys(PRESET_ASPECT_VALUES) as Exclude<AspectRatioOption, "auto">[]).reduce((best, key) =>
    Math.abs(viewportAspect - PRESET_ASPECT_VALUES[key]) < Math.abs(viewportAspect - PRESET_ASPECT_VALUES[best])
      ? key
      : best,
  );
}

export function useShimmerController() {
  const [shimmerState, setShimmerState] = useState<{ cardId: string; token: number } | null>(null);
  const lastTriggerTimeRef = useRef(0);

  function maybeTriggerShimmer(cardId: string) {
    const now = performance.now();
    if (now - lastTriggerTimeRef.current < SHIMMER_COOLDOWN_MS) return;
    lastTriggerTimeRef.current = now;
    setShimmerState({ cardId, token: performance.now() });
  }

  return { shimmerState, maybeTriggerShimmer };
}

export function useMobileDetection() {
  const [isMobileLandscape, setIsMobileLandscape] = useState(() => {
    const isCoarse =
      window.matchMedia("(pointer: coarse)").matches || "ontouchstart" in window || navigator.maxTouchPoints > 0;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    return isCoarse && vw > vh && vw <= MOBILE_LANDSCAPE_MAX_WIDTH;
  });
  const [isPortraitMobile, setIsPortraitMobile] = useState(() => {
    const isCoarse =
      window.matchMedia("(pointer: coarse)").matches || "ontouchstart" in window || navigator.maxTouchPoints > 0;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    return isCoarse && vh > vw && vw <= PORTRAIT_MOBILE_MAX_WIDTH;
  });

  const check = useCallback(() => {
    const isCoarse =
      window.matchMedia("(pointer: coarse)").matches || "ontouchstart" in window || navigator.maxTouchPoints > 0;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    setIsMobileLandscape(isCoarse && vw > vh && vw <= MOBILE_LANDSCAPE_MAX_WIDTH);
    setIsPortraitMobile(isCoarse && vh > vw && vw <= PORTRAIT_MOBILE_MAX_WIDTH);
  }, []);

  useEffect(() => {
    function handleOrientationChange() {
      setTimeout(check, ORIENTATION_CHANGE_DEBOUNCE_MS);
    }

    window.addEventListener("resize", check);
    window.addEventListener("orientationchange", handleOrientationChange);
    return () => {
      window.removeEventListener("resize", check);
      window.removeEventListener("orientationchange", handleOrientationChange);
    };
  }, [check]);

  return { isMobileLandscape, isPortraitMobile };
}

export function useVirtualResolution(
  selectedAspectRatio: AspectRatioOption,
  bypassVr = false,
  mobileLandscape = false,
) {
  const [viewportSize, setViewportSize] = useState(() => ({
    width: typeof window !== "undefined" ? window.innerWidth : 1920,
    height: typeof window !== "undefined" ? window.innerHeight : 1080,
  }));

  useEffect(() => {
    function handleResize() {
      setViewportSize({ width: window.innerWidth, height: window.innerHeight });
    }
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  if (bypassVr) {
    return {
      frameStyle: { width: "100%", height: "100%" },
      stageStyle: { width: "100%", height: "100%", transform: "none", transformOrigin: "top left", left: 0, top: 0 },
      aspectMode: "standard" as "standard" | "narrow" | "ultrawide",
      stagePixelRatio: 1,
    };
  }

  const resolvedAspectRatio =
    selectedAspectRatio === "auto"
      ? resolveAutoAspectRatio(viewportSize.width, viewportSize.height)
      : selectedAspectRatio;
  const selectedSize = ASPECT_RATIO_STAGE_SIZES[resolvedAspectRatio];
  let stageHeight = mobileLandscape ? MOBILE_STAGE_HEIGHT : DESIGN_STAGE_HEIGHT;
  let stageWidth = mobileLandscape
    ? Math.round(stageHeight * (viewportSize.width / viewportSize.height))
    : Math.round(stageHeight * (selectedSize.width / selectedSize.height));
  const viewportAspect = viewportSize.width / viewportSize.height;
  const stageAspect = stageWidth / stageHeight;

  let scale: number;
  if (viewportAspect > stageAspect) {
    scale = viewportSize.height / stageHeight;
  } else {
    scale = viewportSize.width / stageWidth;
  }
  scale = Math.max(MIN_STAGE_SCALE, Math.min(MAX_STAGE_SCALE, scale));

  // When the natural scale is >= 1.5, avoid CSS transform scaling by rendering
  // the stage at a natively larger pixel size and setting scale to 1.0. This
  // preserves subpixel antialiasing on high-DPI displays (4K+).
  // Guard: only apply when the multiplied stage fits within the viewport
  // (ultrawide aspect at 4K would overflow otherwise).
  const nativeMultiplier = Math.round(scale);
  const useNativeResolution =
    !mobileLandscape &&
    scale >= 1.5 &&
    stageWidth * nativeMultiplier <= viewportSize.width &&
    stageHeight * nativeMultiplier <= viewportSize.height;
  const stagePixelRatio = useNativeResolution ? nativeMultiplier : 1;

  if (useNativeResolution) {
    stageWidth *= stagePixelRatio;
    stageHeight *= stagePixelRatio;
    scale = 1.0;
  }

  const frameWidth = stageWidth * scale;
  const frameHeight = stageHeight * scale;

  const aspectMode =
    resolvedAspectRatio === "16:10"
      ? ("narrow" as const)
      : resolvedAspectRatio === "21:9"
        ? ("ultrawide" as const)
        : ("standard" as const);

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
    aspectMode,
    stagePixelRatio,
  };
}
