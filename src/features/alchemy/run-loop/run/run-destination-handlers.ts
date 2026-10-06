import type { BattleStarted } from "@/features/alchemy/shared/stores/battle-start-commands";
import type { GameSession } from "@/features/alchemy/shared/stores/game-session-types";
import { sessionFeedback } from "@/features/alchemy/shared/stores/session-capabilities";
import { ROUTE_SCREENS, type Screen } from "@/lib/routing";
import type { RunRoomEntered } from "./room-entry-commands";

export interface RoomPresentation {
  navigateTo: (screen: Screen) => void;
  presentBattleStart: (result: BattleStarted) => void;
}

export function presentRunRoomEntry(
  entry: RunRoomEntered,
  presentation: RoomPresentation,
  gameSession: GameSession,
): void {
  // Opening Companion actions can settle the battle immediately. Their outcome
  // navigation must supersede this initial display request, including headless play.
  presentation.navigateTo(entry.screen);
  if (entry.battle) presentation.presentBattleStart(entry.battle);
  else if (entry.screen === ROUTE_SCREENS.MYSTERY) sessionFeedback(gameSession).playUISound("musicBoxMystery");
}
