import type { Screen } from "@/lib/routing";
import { getRunSession } from "@/features/alchemy/shared/stores/run-session-model";

/** Current lifecycle phase from live stores and the active screen (test helper). */
export function getCurrentRunPhase(screen?: Screen) {
  return getRunSession(screen).phase;
}
