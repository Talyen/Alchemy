import type { Screen } from "@/features/alchemy/shared/types";
import { defineFieldSetter } from "./_field-setter";

type ImmerSet = (fn: (state: any) => void) => void;

export type NavigationActions = {
  setScreen: (action: Screen | ((prev: Screen) => Screen)) => void;
  resetNavigation: () => void;
};

export function defineNavigationActions(set: ImmerSet): NavigationActions {
  const setField = defineFieldSetter<{ screen: Screen }>(set, "navigation");

  return {
    setScreen: setField("screen"),
    resetNavigation: () =>
      set((state: any) => {
        state.navigation.screen = "menu";
      }),
  };
}
