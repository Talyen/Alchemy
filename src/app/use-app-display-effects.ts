// Root-level display preference side effects for platform windowing and stage CSS.
// Depends on the platform adapter and alchemy display option types.
import { useEffect, useLayoutEffect, type RefObject } from "react";

import { platform } from "@/lib/platform";
import type { DisplayMode, UiScale } from "@/features/alchemy/types";

type AppDisplayEffectsOptions = {
  displayMode: DisplayMode;
  uiScale: UiScale;
  brightness: number;
  stageRef: RefObject<HTMLDivElement | null>;
};

// Keeps browser/document and desktop display settings synchronized with options state.
const DISPLAY_CONFIG = {
  UI_SCALE_CSS_PROPERTY: "--alchemy-ui-scale",
  PERCENTAGE_DIVISOR: 100,
} as const;

export function useAppDisplayEffects({ displayMode, uiScale, brightness, stageRef }: AppDisplayEffectsOptions) {
  useEffect(() => {
    platform.setDisplayMode(displayMode);
  }, [displayMode]);

  useLayoutEffect(() => {
    const scaleFactor = String(Number(uiScale) / DISPLAY_CONFIG.PERCENTAGE_DIVISOR);
    document.documentElement.style.setProperty(DISPLAY_CONFIG.UI_SCALE_CSS_PROPERTY, scaleFactor);
  }, [uiScale]);

  useLayoutEffect(() => {
    if (stageRef.current) {
      const brightnessFactor = brightness / DISPLAY_CONFIG.PERCENTAGE_DIVISOR;
      stageRef.current.style.filter = `brightness(${brightnessFactor})`;
    }
  }, [brightness, stageRef]);
}
