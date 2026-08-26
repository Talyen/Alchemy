// Ephemeral card hover and shimmer UI state (global across screens).
import { create } from "zustand";
import { SHIMMER_COOLDOWN_MS } from "@/lib/game-constants";
import type { PlasmaColorPair } from "@/lib/animation/plasma-colors";

type ShimmerState = { cardId: string; token: number } | null;

interface PlasmaRegistration {
  ownerId: string;
  colorPair: PlasmaColorPair;
}

interface UiStore {
  hoveredCardId: string | null;
  shimmerState: ShimmerState;
  plasmaBaseline: PlasmaRegistration | null;
  plasmaInteraction: PlasmaRegistration | null;
  setHoveredCardId: (id: string | null | ((prev: string | null) => string | null)) => void;
  clearCardHover: () => void;
  maybeTriggerShimmer: (cardId: string) => void;
  setPlasmaBaseline: (registration: PlasmaRegistration) => void;
  clearPlasmaBaseline: (ownerId: string) => void;
  setPlasmaInteraction: (registration: PlasmaRegistration) => void;
  clearPlasmaInteraction: (ownerId: string) => void;
}

export const useUiStore = create<UiStore>()((set, get) => ({
  hoveredCardId: null,
  shimmerState: null,
  plasmaBaseline: null,
  plasmaInteraction: null,

  setHoveredCardId: (id) => set((s) => ({ hoveredCardId: typeof id === "function" ? id(s.hoveredCardId) : id })),
  clearCardHover: () => set({ hoveredCardId: null }),
  maybeTriggerShimmer: (cardId) => {
    const state = get();
    if (state.shimmerState && performance.now() - state.shimmerState.token < SHIMMER_COOLDOWN_MS) return;
    set({ shimmerState: { cardId, token: performance.now() } });
  },
  setPlasmaBaseline: (registration) => set({ plasmaBaseline: registration }),
  clearPlasmaBaseline: (ownerId) =>
    set((state) => (state.plasmaBaseline?.ownerId === ownerId ? { plasmaBaseline: null } : state)),
  setPlasmaInteraction: (registration) => set({ plasmaInteraction: registration }),
  clearPlasmaInteraction: (ownerId) =>
    set((state) => (state.plasmaInteraction?.ownerId === ownerId ? { plasmaInteraction: null } : state)),
}));
