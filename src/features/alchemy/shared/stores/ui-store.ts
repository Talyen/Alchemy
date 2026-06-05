// Ephemeral card hover and shimmer UI state (global across screens).
import { create } from "zustand";
import { SHIMMER_COOLDOWN_MS } from "@/lib/game-constants";

type ShimmerState = { cardId: string; token: number } | null;

type UiStore = {
  hoveredCardId: string | null;
  shimmerState: ShimmerState;
  setHoveredCardId: (id: string | null | ((prev: string | null) => string | null)) => void;
  clearCardHover: () => void;
  maybeTriggerShimmer: (cardId: string) => void;
};

export const useUiStore = create<UiStore>()((set, get) => ({
  hoveredCardId: null,
  shimmerState: null,

  setHoveredCardId: (id) => set((s) => ({ hoveredCardId: typeof id === "function" ? id(s.hoveredCardId) : id })),
  clearCardHover: () => set({ hoveredCardId: null }),
  maybeTriggerShimmer: (cardId) => {
    const state = get();
    if (state.shimmerState && performance.now() - state.shimmerState.token < SHIMMER_COOLDOWN_MS) return;
    set({ shimmerState: { cardId, token: performance.now() } });
  },
}));
