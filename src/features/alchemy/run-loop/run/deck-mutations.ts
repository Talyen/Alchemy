// Shared run deck/trinket mutations with compendium discovery tracking.
// Depends on game-data types and appendUnique helper.
import type { BattleCard } from "@/lib/game-data";
import { appendUnique } from "@/lib/utils";
import { setDiscoveredCardIds, setDiscoveredTrinketIds } from "../../shared/stores/profile-store";
import type { GameplayDraft } from "@/features/alchemy/shared/stores/run-session-command";
import { setRunDeck, setRunTrinkets } from "@/features/alchemy/shared/stores/run-session-write-port";

export function appendCardToRunWithDiscovery(draft: GameplayDraft, card: BattleCard): void {
  setRunDeck(draft, (previous) => [...previous, card]);
  setDiscoveredCardIds(draft, (current) => appendUnique(current, card.id));
}

export function appendTrinketToRunWithDiscovery(draft: GameplayDraft, trinketId: string): void {
  setRunTrinkets(draft, (previous) => [...previous, trinketId]);
  setDiscoveredTrinketIds(draft, (current) => appendUnique(current, trinketId));
}
