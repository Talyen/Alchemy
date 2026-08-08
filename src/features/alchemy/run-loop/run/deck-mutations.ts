// Shared run deck/trinket mutations with compendium discovery tracking.
// Depends on game-data types and appendUnique helper.
import type { BattleCard } from "@/lib/game-data";
import { appendUnique } from "@/lib/utils";
import { setDiscoveredCardIds, setDiscoveredTrinketIds } from "../../shared/stores/profile-store";
import {
  dispatchRunSessionCommand,
  invokeDraftAction,
  type GameplayDraft,
} from "@/features/alchemy/shared/stores/run-session-command";

type StateUpdater<T> = (value: T | ((previous: T) => T)) => void;

export function appendCardToRunWithDiscovery(
  card: BattleCard,
  setRunDeck: StateUpdater<BattleCard[]>,
  draft?: GameplayDraft,
): void {
  if (draft) {
    invokeDraftAction(setRunDeck, draft, (p) => [...p, card]);
    invokeDraftAction(setDiscoveredCardIds, draft, (cur) => appendUnique(cur, card.id));
    return;
  }
  dispatchRunSessionCommand((nextDraft) => appendCardToRunWithDiscovery(card, setRunDeck, nextDraft));
}

export function appendTrinketToRunWithDiscovery(
  trinketId: string,
  setRunTrinkets: StateUpdater<string[]>,
  draft?: GameplayDraft,
): void {
  if (draft) {
    invokeDraftAction(setRunTrinkets, draft, (p) => [...p, trinketId]);
    invokeDraftAction(setDiscoveredTrinketIds, draft, (cur) => appendUnique(cur, trinketId));
    return;
  }
  dispatchRunSessionCommand((nextDraft) => appendTrinketToRunWithDiscovery(trinketId, setRunTrinkets, nextDraft));
}
