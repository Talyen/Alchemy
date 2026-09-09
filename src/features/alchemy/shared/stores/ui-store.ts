import { create } from "zustand";
import { SHIMMER_COOLDOWN_MS } from "@/lib/game-constants";
import type { PlasmaColorPair } from "@/lib/animation/plasma-colors";

import type { CardInspectionView } from "../types";

type ShimmerState = { cardId: string; token: number } | null;

interface PlasmaRegistration {
  ownerId: string;
  colorPair: PlasmaColorPair;
}

interface UiStore {
  enemyInspectionOpen: boolean;
  setEnemyInspectionOpen: (open: boolean) => void;
  cardInspection: CardInspectionView | null;
  setCardInspection: (view: CardInspectionView | null) => void;
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
  enemyInspectionOpen: false,
  setEnemyInspectionOpen: (enemyInspectionOpen) =>
    set({ enemyInspectionOpen, ...(enemyInspectionOpen ? { cardInspection: null } : {}) }),
  cardInspection: null,
  setCardInspection: (cardInspection) =>
    set({ cardInspection, ...(cardInspection ? { enemyInspectionOpen: false } : {}) }),
  hoveredCardId: null,
  shimmerState: null,
  plasmaBaseline: null,
  plasmaInteraction: null,

  setHoveredCardId: (id) => set((s) => ({ hoveredCardId: typeof id === "function" ? id(s.hoveredCardId) : id })),
  clearCardHover: () => set({ hoveredCardId: null }),
  maybeTriggerShimmer: (cardId) => {
    const state = get();
    if (
      state.shimmerState &&
      state.shimmerState.cardId === cardId &&
      performance.now() - state.shimmerState.token < SHIMMER_COOLDOWN_MS
    )
      return;
    set({ shimmerState: { cardId, token: performance.now() } });
  },
  setPlasmaBaseline: (registration) => set({ plasmaBaseline: registration }),
  clearPlasmaBaseline: (ownerId) =>
    set((state) => (state.plasmaBaseline?.ownerId === ownerId ? { plasmaBaseline: null } : state)),
  setPlasmaInteraction: (registration) => set({ plasmaInteraction: registration }),
  clearPlasmaInteraction: (ownerId) =>
    set((state) => (state.plasmaInteraction?.ownerId === ownerId ? { plasmaInteraction: null } : state)),
}));

export function isBattleInspectionOpen(state: Pick<UiStore, "cardInspection" | "enemyInspectionOpen">): boolean {
  return state.cardInspection !== null || state.enemyInspectionOpen;
}
