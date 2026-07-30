// Shared run deck/trinket mutations with compendium discovery tracking.
// Depends on game-data types and appendUnique helper.
import type { BattleCard } from "@/lib/game-data";
import { appendUnique } from "@/lib/utils";
import type { Dispatch, SetStateAction } from "react";
import { useProfileStore } from "../../shared/stores/profile-store";
import { runSessionTransaction } from "../../shared/stores/run-session-facade";

export function appendCardToRunWithDiscovery(
  card: BattleCard,
  setRunDeck: Dispatch<SetStateAction<BattleCard[]>>,
): void {
  runSessionTransaction(() => {
    setRunDeck((p) => [...p, card]);
    useProfileStore.getState().setDiscoveredCardIds((cur) => appendUnique(cur, card.id));
  });
}

export function appendTrinketToRunWithDiscovery(
  trinketId: string,
  setRunTrinkets: Dispatch<SetStateAction<string[]>>,
): void {
  runSessionTransaction(() => {
    setRunTrinkets((p) => [...p, trinketId]);
    useProfileStore.getState().setDiscoveredTrinketIds((cur) => appendUnique(cur, trinketId));
  });
}
