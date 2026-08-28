import type { BattleCard } from "@/lib/game-data";
import { discoverCardIds, discoverTrinketIds } from "../../shared/stores/profile-store";
import type { GameplayDraft } from "@/features/alchemy/shared/stores/run-session-command";
import { setRunDeck, setRunBoons } from "@/features/alchemy/shared/stores/run-session-write-port";

export { discoverCardIds };

export function appendCardToRunWithDiscovery(draft: GameplayDraft, card: BattleCard): void {
  setRunDeck(draft, (previous) => [...previous, card]);
  discoverCardIds(draft, [card.id]);
}

export function appendBoonToRunWithDiscovery(draft: GameplayDraft, trinketId: string): void {
  setRunBoons(draft, (previous) => (previous.includes(trinketId) ? previous : [...previous, trinketId]));
  discoverTrinketIds(draft, [trinketId]);
}
