// Shared run deck/trinket mutations with compendium discovery tracking.
// Depends on game-data types and profile discovery helpers.
import type { BattleCard } from "@/lib/game-data";
import { discoverCardIds, discoverTrinketIds } from "../../shared/stores/profile-store";
import type { GameplayDraft } from "@/features/alchemy/shared/stores/run-session-command";
import { setRunDeck, setRunTrinkets } from "@/features/alchemy/shared/stores/run-session-write-port";

export { discoverCardIds };

export function appendCardToRunWithDiscovery(draft: GameplayDraft, card: BattleCard): void {
  setRunDeck(draft, (previous) => [...previous, card]);
  discoverCardIds(draft, [card.id]);
}

export function appendTrinketToRunWithDiscovery(draft: GameplayDraft, trinketId: string): void {
  setRunTrinkets(draft, (previous) => (previous.includes(trinketId) ? previous : [...previous, trinketId]));
  discoverTrinketIds(draft, [trinketId]);
}
