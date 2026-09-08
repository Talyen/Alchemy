import type { BattleCard } from "@/lib/game-data";
import type { GearInstance } from "@/lib/gear";
import { mutateGearWithRunHealthSync } from "@/features/alchemy/shared/stores/gear-session-command";
import { discoverCardIds, discoverTrinketIds } from "../../shared/stores/profile-store";
import type { GameplayDraft } from "@/features/alchemy/shared/stores/run-session-command";
import {
  recordRunObtainedItem,
  setRunDeck,
  setRunBoons,
} from "@/features/alchemy/shared/stores/run-session-write-port";

export { discoverCardIds };

export function appendCardToRunWithDiscovery(draft: GameplayDraft, card: BattleCard): void {
  setRunDeck(draft, (previous) => [...previous, card]);
  discoverCardIds(draft, [card.id]);
}

export function appendBoonToRunWithDiscovery(draft: GameplayDraft, trinketId: string): void {
  setRunBoons(draft, (previous) => (previous.includes(trinketId) ? previous : [...previous, trinketId]));
  discoverTrinketIds(draft, [trinketId]);
}

export function grantGearToRunWithRecord(draft: GameplayDraft, instance: GearInstance): void {
  const characterId = draft.run.activeRun.characterId;
  mutateGearWithRunHealthSync(draft, {
    mutate: (gear) => gear.addInstance(instance, characterId),
  });
  recordRunObtainedItem(draft, { kind: "gear", instance });
}

export function grantTrinketToRunWithRecord(draft: GameplayDraft, trinketId: string): void {
  mutateGearWithRunHealthSync(draft, { mutate: (gear) => gear.addTrinket(trinketId) });
  discoverTrinketIds(draft, [trinketId]);
  recordRunObtainedItem(draft, { kind: "trinket", trinketId });
}
