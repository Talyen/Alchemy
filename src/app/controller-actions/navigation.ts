// Navigation actions shared across menu and run screens.
import type { Screen } from "@/lib/routing";

export type NavigationActions = {
  navigateTo: (screen: Screen) => void;
  goToScreen: (screen: Screen) => void;
};
