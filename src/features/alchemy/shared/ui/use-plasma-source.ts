import { useEffect, useId } from "react";

import type { PlasmaColorPair } from "@/lib/animation/plasma-colors";
import { useUiStore } from "../stores/ui-store";

function usePlasmaRegistration(colorPair: PlasmaColorPair | null, active: boolean, baseline: boolean) {
  const ownerId = useId();
  const setSource = useUiStore((state) => (baseline ? state.setPlasmaBaseline : state.setPlasmaInteraction));
  const clearSource = useUiStore((state) => (baseline ? state.clearPlasmaBaseline : state.clearPlasmaInteraction));
  const primary = colorPair?.primary;
  const secondary = colorPair?.secondary;

  useEffect(() => {
    if (!active || !primary || !secondary) {
      clearSource(ownerId);
      return;
    }

    setSource({ ownerId, colorPair: { primary, secondary } });
    return () => clearSource(ownerId);
  }, [active, clearSource, ownerId, primary, secondary, setSource]);
}

export function usePlasmaInteraction(colorPair: PlasmaColorPair | null, active: boolean) {
  usePlasmaRegistration(colorPair, active, false);
}

export function usePlasmaBaseline(colorPair: PlasmaColorPair | null) {
  usePlasmaRegistration(colorPair, colorPair !== null, true);
}
