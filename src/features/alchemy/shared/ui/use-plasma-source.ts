import { useEffect, useId, useState } from "react";

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

// Filter decoration only; object highlights and other interaction feedback stay immediate.
export function usePlasmaDisplayColorPair(): PlasmaColorPair | null {
  const baseline = useUiStore((state) => state.plasmaBaseline?.colorPair ?? null);
  const interaction = useUiStore((state) => state.plasmaInteraction?.colorPair ?? null);
  const primary = interaction?.primary;
  const secondary = interaction?.secondary;
  const [settledInteraction, setSettledInteraction] = useState<PlasmaColorPair | null>(null);

  useEffect(() => {
    const next = primary && secondary ? { primary, secondary } : null;
    const timer = window.setTimeout(() => setSettledInteraction(next), next ? 80 : 120);
    return () => window.clearTimeout(timer);
  }, [primary, secondary]);

  return settledInteraction ?? baseline;
}
