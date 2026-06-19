import type { Screen } from "@/features/alchemy/shared/types";
import { defineFieldSetter, type ImmerSet } from "./_field-setter";
import type { RunDomainDataState } from "../run-domain-types";

export type NavigationActions = {
  setScreen: (action: Screen | ((prev: Screen) => Screen)) => void;
  resetNavigation: () => void;
};

export function defineNavigationActions(set: ImmerSet<RunDomainDataState>): NavigationActions {
  const setField = defineFieldSetter<{ screen: Screen }>(set, "navigation");

  return {
    setScreen: setField("screen"),
    resetNavigation: () =>
      set((state) => {
        state.navigation.screen = "menu";
      }),
  };
}
