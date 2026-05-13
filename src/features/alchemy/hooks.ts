// React hooks for card shimmer, mobile detection, and virtual-resolution scaling.
// Depends on alchemy UI types and viewport/timing constants.
// Used by controllers/App to keep animation and viewport side effects reusable.
import { useCallback, useEffect, useRef, useState } from "react";

import type { ResolutionOption } from "./types";
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

// ---- Card Shimmer (Hover Effect) ----
// Manages the "shimmer" animation that sweeps across card art on mouse hover.
// Cooldown prevents rapid re-triggering; intro delay ensures the first hover
// on a screen doesn't feel delayed.

const shimmerCooldownMs = SHIMMER_COOLDOWN_MS;

export function useShimmerController() {
  const [shimmerState, setShimmerState] = useState<{ cardId: string; token: number } | null>(null);
  const lastTriggerTimeRef = useRef(0);

  function maybeTriggerShimmer(cardId: string) {
    const now = performance.now();
    if (now - lastTriggerTimeRef.current < shimmerCooldownMs) return;
    lastTriggerTimeRef.current = now;
    setShimmerState({ cardId, token: performance.now() });
  }

  return { shimmerState, maybeTriggerShimmer };
}

// ---- Mobile Detection ----
// Detects mobile landscape and portrait viewports using viewport dimensions
// and pointer media queries. Portrait mobile shows a rotate-device prompt;
// mobile landscape gets a full-viewport layout without virtual-resolution scaling.
export function useMobileDetection() {
  const [isMobileLandscape, setIsMobileLandscape] = useState(false);
  const [isPortraitMobile, setIsPortraitMobile] = useState(false);

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

    check(); // eslint-disable-line react-hooks/set-state-in-effect
    window.addEventListener("resize", check);
    window.addEventListener("orientationchange", handleOrientationChange);
    return () => {
      window.removeEventListener("resize", check);
      window.removeEventListener("orientationchange", handleOrientationChange);
    };
  }, [check]);

  return { isMobileLandscape, isPortraitMobile };
}

// ---- Virtual Resolution ----
// Wraps the game canvas in a CSS scale transform so it fits the window. The
// selected resolution contributes aspect ratio only on desktop; mobile landscape
// uses the live phone aspect ratio so battle can keep the desktop composition
// without rendering into a narrow 16:9 letterbox.
export function useVirtualResolution(selectedResolution: ResolutionOption, bypassVr = false, mobileLandscape = false) {
  const [viewportSize, setViewportSize] = useState(() => ({ width: window.innerWidth, height: window.innerHeight }));

  useEffect(() => {
    function handleResize() {
      setViewportSize({ width: window.innerWidth, height: window.innerHeight });
    }
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  // Bypass VR for the mobile battle layout — it uses a compact flex layout
  // designed for the native viewport.
  if (bypassVr) {
    return {
      frameStyle: { width: "100%", height: "100%" },
      stageStyle: { width: "100%", height: "100%", transform: "none", transformOrigin: "top left", left: 0, top: 0 },
    };
  }

  const [selectedWidth, selectedHeight] = selectedResolution.split("x").map(Number);
  const stageHeight = mobileLandscape ? MOBILE_STAGE_HEIGHT : DESIGN_STAGE_HEIGHT;
  const stageWidth = mobileLandscape
    ? Math.round(stageHeight * (viewportSize.width / viewportSize.height))
    : Math.round(stageHeight * (selectedWidth / selectedHeight));
  const viewportAspect = viewportSize.width / viewportSize.height;
  const stageAspect = stageWidth / stageHeight;

  let scale: number;
  if (viewportAspect > stageAspect) {
    scale = viewportSize.height / stageHeight;
  } else {
    scale = viewportSize.width / stageWidth;
  }
  scale = Math.max(MIN_STAGE_SCALE, Math.min(MAX_STAGE_SCALE, scale));

  const frameWidth = stageWidth * scale;
  const frameHeight = stageHeight * scale;

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
  };
}
