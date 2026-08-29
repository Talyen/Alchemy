import type { Screen } from "@/lib/routing";
import { getRunSession } from "@/features/alchemy/shared/stores/run-reads";

export function getCurrentRunPhase(screen?: Screen) {
  return getRunSession(screen).phase;
}
