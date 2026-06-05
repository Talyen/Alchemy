// Navigation slice types (state lives in run-domain-store).
import type { Screen } from "@/features/alchemy/types";
import type { Setter } from "@/lib/utils";

export type NavigationStore = {
  screen: Screen;
  setScreen: Setter<Screen>;
  reset: () => void;
};
