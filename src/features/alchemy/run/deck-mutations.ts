// Shared run deck/trinket mutations with compendium discovery tracking.
// Depends on game-data types and appendUnique helper.
import type { BattleCard } from "@/lib/game-data";
import { appendUnique } from "@/lib/utils";
import type { Dispatch, SetStateAction } from "react";

export type RunDeckDiscoverySetters = {
  setRunDeck: Dispatch<SetStateAction<BattleCard[]>>;
  setDiscoveredCardIds: Dispatch<SetStateAction<string[]>>;
};

export type RunTrinketDiscoverySetters = {
  setRunTrinkets: Dispatch<SetStateAction<string[]>>;
  setDiscoveredTrinketIds: Dispatch<SetStateAction<string[]>>;
};

export function appendCardToRunWithDiscovery(card: BattleCard, setters: RunDeckDiscoverySetters): void {
  setters.setRunDeck((p) => [...p, card]);
  setters.setDiscoveredCardIds((cur) => appendUnique(cur, card.id));
}

export function appendTrinketToRunWithDiscovery(trinketId: string, setters: RunTrinketDiscoverySetters): void {
  setters.setRunTrinkets((p) => [...p, trinketId]);
  setters.setDiscoveredTrinketIds((cur) => appendUnique(cur, trinketId));
}
