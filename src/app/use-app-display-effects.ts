// Root-level display preference side effects for platform windowing and stage CSS.
// Depends on the platform adapter and alchemy display option types.
import { useEffect, type RefObject } from "react";

import { platform } from "@/lib/platform";
import type { DisplayMode, UiScale } from "@/features/alchemy/types";

type AppDisplayEffectsOptions = {
  displayMode: DisplayMode;
  uiScale: UiScale;
  brightness: number;
  stageRef: RefObject<HTMLDivElement | null>;
};

// Keeps browser/document and desktop display settings synchronized with options state.
export function useAppDisplayEffects({ displayMode, uiScale, brightness, stageRef }: AppDisplayEffectsOptions) {
  useEffect(() => { platform.setDisplayMode(displayMode); }, [displayMode]);
  useEffect(() => { document.documentElement.style.setProperty("--alchemy-ui-scale", String(Number(uiScale) / 100)); }, [uiScale]);
  useEffect(() => {
    if (stageRef.current) {
      stageRef.current.style.filter = `brightness(${brightness / 100})`;
    }
  }, [brightness, stageRef]);
}
