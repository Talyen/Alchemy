import type { Screen } from "@/lib/routing";
import { getRunSession } from "@/features/alchemy/shared/stores/run-session-model";

export function getCurrentRunPhase(screen?: Screen) {
  return getRunSession(screen).phase;
}
