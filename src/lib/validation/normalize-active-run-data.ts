// Save-load normalization during Zod ActiveRunDataSchema.transform only.
// For runtime hydration of unknown payloads, use parseActiveRun from @/lib/active-run-session.
// This is business logic (run initialization, legacy deck detection) that operates
// on raw Record<string, unknown> input before Zod schema parsing completes.
// Depends on: game-data, game-constants.
// Used by: save-schemas.ts (ActiveRunDataSchema.transform), tests.
import { getStartingDeck } from "@/lib/game-data";
import { LEGACY_STARTER_DECK_IDS } from "@/lib/game-constants";
import { emptyInventory } from "@/lib/homestead/inventory";
import type { MaterialInventory } from "@/lib/homestead/types";

export function normalizeActiveRunData<T extends Record<string, unknown>>(
  data: T,
): T & {
  contentSystemType: string;
  runPlayerHealth: number;
  completedDestinations: string[];
  runDeck: unknown;
  runTalentXP: Record<string, number>;
  runMaterialsEarned: MaterialInventory;
  labyrinthMap: unknown;
  labyrinthPendingNode: unknown;
  activeCombat: unknown;
} {
  const labyrinthMap = data.labyrinthMap;
  let contentSystemType = data.contentSystemType as string;
  if (contentSystemType === "labyrinth" && !labyrinthMap) {
    contentSystemType = "campaign";
  }
  const runPlayerHealth = Math.min(data.runPlayerHealth as number, data.runMaxHealth as number);
  const roomsEncountered = typeof data.roomsEncountered === "number" ? data.roomsEncountered : 0;
  const currentAct = typeof data.currentAct === "number" ? data.currentAct : 1;
  const destinationIndexInAct = typeof data.destinationIndexInAct === "number" ? data.destinationIndexInAct : 0;
  const completedDestinations = Array.isArray(data.completedDestinations)
    ? (data.completedDestinations as string[])
    : [];
  const isUnstarted =
    roomsEncountered === 0 && currentAct === 1 && destinationIndexInAct === 0 && completedDestinations.length === 0;
  const runDeckArr = Array.isArray(data.runDeck) ? (data.runDeck as Array<{ id: string }>) : [];
  const legacySet = new Set(LEGACY_STARTER_DECK_IDS);
  const hasLegacyDeck =
    runDeckArr.length === LEGACY_STARTER_DECK_IDS.length &&
    runDeckArr.every((card) => legacySet.has(card.id as (typeof LEGACY_STARTER_DECK_IDS)[number]));
  const characterId = typeof data.characterId === "string" ? data.characterId : "";
  const preserveEmptyWildwoodDraft = contentSystemType === "wildwood" && Boolean(data.wildwoodDraft);
  const runDeck =
    (!preserveEmptyWildwoodDraft && runDeckArr.length === 0) || (isUnstarted && hasLegacyDeck)
      ? characterId
        ? getStartingDeck(characterId as import("@/lib/game-data").CharacterId)
        : []
      : runDeckArr;
  return {
    ...data,
    contentSystemType,
    runPlayerHealth,
    completedDestinations,
    runDeck,
    runTalentXP: (data.runTalentXP as Record<string, number> | undefined) ?? {},
    runMaterialsEarned: (data.runMaterialsEarned as MaterialInventory | undefined) ?? emptyInventory(),
    labyrinthMap: contentSystemType === "labyrinth" ? data.labyrinthMap : null,
    labyrinthPendingNode: contentSystemType === "labyrinth" ? data.labyrinthPendingNode : null,
    wildwoodDraft: contentSystemType === "wildwood" ? data.wildwoodDraft : null,
    activeCombat: data.activeCombat
      ? {
          ...(data.activeCombat as Record<string, unknown>),
          activeLabyrinthModifiers:
            contentSystemType === "labyrinth"
              ? ((data.activeCombat as Record<string, unknown>).activeLabyrinthModifiers ?? [])
              : [],
          activeLabyrinthRewardModifiers:
            contentSystemType === "labyrinth"
              ? ((data.activeCombat as Record<string, unknown>).activeLabyrinthRewardModifiers ?? [])
              : [],
        }
      : null,
  };
}
