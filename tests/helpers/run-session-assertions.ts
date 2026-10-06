import type { Screen } from "@/lib/routing";
import { getRunSession } from "@/features/alchemy/shared/stores/run-reads";
import { defaultGameSession } from "@/app/application-session";

export function getCurrentRunPhase(screen?: Screen) {
  return getRunSession(screen, defaultGameSession).phase;
}
