// Current in-game screen routing state (decoupled from run progression and session UI).
import { create } from "zustand";
import type { Screen } from "@/features/alchemy/types";
import type { Setter } from "@/lib/utils";

export type NavigationStore = {
  screen: Screen;
  setScreen: Setter<Screen>;
  reset: () => void;
};

export const useNavigationStore = create<NavigationStore>()((set) => ({
  screen: "menu",

  setScreen: (action) =>
    set((s) => ({
      screen: typeof action === "function" ? action(s.screen) : action,
    })),

  reset: () => set({ screen: "menu" }),
}));
