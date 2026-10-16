import { create } from "zustand";
import { SHIMMER_COOLDOWN_MS } from "@/lib/game-constants";
import type { PlasmaColorPair } from "@/lib/animation/plasma-colors";

import type { CardInspectionView } from "../types";

type ShimmerState = { cardId: string; token: number; triggeredAt: number } | null;

// Pure cooldown core: monotonic token (change signal) plus a timestamp, so
// unit tests can drive timing with an injected `now` (the store seam still
// reads Date.now()).
export function nextShimmerState(previous: ShimmerState, cardId: string, now: number): ShimmerState {
  if (previous && previous.cardId === cardId && now - previous.triggeredAt < SHIMMER_COOLDOWN_MS) return previous;
  return { cardId, token: (previous?.token ?? 0) + 1, triggeredAt: now };
}

interface PlasmaRegistration {
  ownerId: string;
  colorPair: PlasmaColorPair;
}

interface UiStore {
  enemyInspectionOpen: boolean;
  setEnemyInspectionOpen: (open: boolean) => void;
  cardInspection: CardInspectionView | null;
  setCardInspection: (view: CardInspectionView | null) => void;
  showClearSaveConfirm: boolean;
  setShowClearSaveConfirm: (open: boolean) => void;
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
  showClearSaveConfirm: false,
  setShowClearSaveConfirm: (showClearSaveConfirm) => set({ showClearSaveConfirm }),
  hoveredCardId: null,
  autoplayPreviewCardId: null,
  shimmerState: null,
  plasmaBaseline: null,
  plasmaInteraction: null,

  setHoveredCardId: (id) => set((s) => ({ hoveredCardId: typeof id === "function" ? id(s.hoveredCardId) : id })),
  setAutoplayPreviewCardId: (autoplayPreviewCardId) => set({ autoplayPreviewCardId }),
  clearCardHover: () => set({ hoveredCardId: null, autoplayPreviewCardId: null }),
  maybeTriggerShimmer: (cardId) => {
    const previous = get().shimmerState;
    const next = nextShimmerState(previous, cardId, Date.now());
    if (next === previous) return;
    set({ shimmerState: next });
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
