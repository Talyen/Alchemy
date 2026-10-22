import { getRunPhase } from "@/lib/routing";
import { readActiveRunScreen, readHasActiveBattle } from "@/features/alchemy/shared/stores/session/run-reads";
import { defaultGameSession } from "@/app/application-session";

export function getCurrentRunPhase(screen = readActiveRunScreen(defaultGameSession)) {
  return getRunPhase(screen, readHasActiveBattle(defaultGameSession));
}
