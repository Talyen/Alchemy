import type { BattleCard } from "@/lib/game-data";
import type { GearInstance } from "@/lib/gear";
import { acquireGearDuringRun, acquireTrinketDuringRun } from "./gear-session-command";
import { discoverCardIds, discoverTrinketIds } from "../session/profile-store";
import type { RunTransaction } from "./run-session-command";
import { recordRunObtainedItem, setRunDeck, setRunBoons } from "./run-session-write-port";

export function appendCardToRunWithDiscovery(draft: RunTransaction, card: BattleCard): void {
  setRunDeck(draft, (previous) => [...previous, card]);
  discoverCardIds(draft, [card.id]);
}

export function appendBoonToRunWithDiscovery(draft: RunTransaction, trinketId: string): void {
  setRunBoons(draft, (previous) => (previous.includes(trinketId) ? previous : [...previous, trinketId]));
  discoverTrinketIds(draft, [trinketId]);
}

export function grantGearToRunWithRecord(draft: RunTransaction, instance: GearInstance): void {
  acquireGearDuringRun(draft, instance);
  recordRunObtainedItem(draft, { kind: "gear", instance });
}

export function grantTrinketToRunWithRecord(draft: RunTransaction, trinketId: string): void {
  const added = acquireTrinketDuringRun(draft, trinketId);
  if (!added) return;
  recordRunObtainedItem(draft, { kind: "trinket", trinketId });
}
