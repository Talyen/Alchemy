import { create } from "zustand";
import { SHIMMER_COOLDOWN_MS } from "@/lib/game-constants";
import type { PlasmaColorPair } from "@/lib/animation/plasma-colors";

import type { CardInspectionView } from "../types";

type ShimmerState = { cardId: string; token: number; triggeredAt: number } | null;

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
  autoplayPreviewCardId: string | null;
  shimmerState: ShimmerState;
  plasmaBaseline: PlasmaRegistration | null;
  plasmaInteraction: PlasmaRegistration | null;
  setHoveredCardId: (id: string | null | ((prev: string | null) => string | null)) => void;
  setAutoplayPreviewCardId: (id: string | null) => void;
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
  autoplayPreviewCardId: null,
  shimmerState: null,
  plasmaBaseline: null,
  plasmaInteraction: null,

  setHoveredCardId: (id) => set((s) => ({ hoveredCardId: typeof id === "function" ? id(s.hoveredCardId) : id })),
  setAutoplayPreviewCardId: (autoplayPreviewCardId) => set({ autoplayPreviewCardId }),
  clearCardHover: () => set({ hoveredCardId: null, autoplayPreviewCardId: null }),
  maybeTriggerShimmer: (cardId) => {
    const state = get();
    // Monotonic token (change signal) plus a Date.now cooldown timestamp, so
    // tests can drive timing with fake timers instead of performance.now().
    const now = Date.now();
    if (
      state.shimmerState &&
      state.shimmerState.cardId === cardId &&
      now - state.shimmerState.triggeredAt < SHIMMER_COOLDOWN_MS
    )
      return;
    set({ shimmerState: { cardId, token: (state.shimmerState?.token ?? 0) + 1, triggeredAt: now } });
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
