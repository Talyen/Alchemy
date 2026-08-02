// Shared run deck/trinket mutations with compendium discovery tracking.
// Depends on game-data types and appendUnique helper.
import type { BattleCard } from "@/lib/game-data";
import { appendUnique } from "@/lib/utils";
import { setDiscoveredCardIds, setDiscoveredTrinketIds } from "../../shared/stores/profile-port";
import { dispatchRunSessionCommand } from "@/features/alchemy/shared/stores/run-session-command";

type StateUpdater<T> = (value: T | ((previous: T) => T)) => void;

export function appendCardToRunWithDiscovery(card: BattleCard, setRunDeck: StateUpdater<BattleCard[]>): void {
  dispatchRunSessionCommand(() => {
    setRunDeck((p) => [...p, card]);
    setDiscoveredCardIds((cur) => appendUnique(cur, card.id));
  });
}

export function appendTrinketToRunWithDiscovery(trinketId: string, setRunTrinkets: StateUpdater<string[]>): void {
  dispatchRunSessionCommand(() => {
    setRunTrinkets((p) => [...p, trinketId]);
    setDiscoveredTrinketIds((cur) => appendUnique(cur, trinketId));
  });
}
