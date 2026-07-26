// Save-load normalization during Zod ActiveRunDataSchema.transform only.
// For runtime hydration of unknown payloads, use parseActiveRun from @/lib/active-run-session.
// This is business logic (run initialization, legacy deck detection) that operates
// on raw Record<string, unknown> input before Zod schema parsing completes.
// Depends on: game-data, game-constants.
// Used by: save-schemas.ts (ActiveRunDataSchema.transform), tests.
import { getStartingDeck, type CharacterId, type TalentXP } from "@/lib/game-data";
import type { ContentSystemId } from "@/lib/content-systems/types";
import { LEGACY_STARTER_DECK_IDS } from "@/lib/game-constants";
import { emptyInventory } from "@/lib/homestead/inventory";
import type { MaterialInventory } from "@/lib/homestead/types";

function computeContentSystemType(data: Record<string, unknown>): ContentSystemId {
  const raw = data.contentSystemType;
  if (raw === "labyrinth" && !data.labyrinthMap) return "campaign";
  if (raw === "labyrinth" || raw === "wildwood" || raw === "campaign") return raw;
  return "campaign";
}

function readNumber(data: Record<string, unknown>, key: string, fallback: number): number {
  return typeof data[key] === "number" ? data[key] : fallback;
}

function readString(data: Record<string, unknown>, key: string, fallback: string): string {
  return typeof data[key] === "string" ? data[key] : fallback;
}

function readStringArray(data: Record<string, unknown>, key: string): string[] {
  return Array.isArray(data[key]) ? (data[key] as string[]) : [];
}

function isUnstartedRun(data: Record<string, unknown>): boolean {
  return (
    readNumber(data, "roomsEncountered", 0) === 0 &&
    readNumber(data, "currentAct", 1) === 1 &&
    readNumber(data, "destinationIndexInAct", 0) === 0 &&
    readStringArray(data, "completedDestinations").length === 0
  );
}

function isLegacyStarterDeck(runDeckArr: Array<{ id: string }>): boolean {
  if (runDeckArr.length !== LEGACY_STARTER_DECK_IDS.length) return false;
  const legacySet = new Set(LEGACY_STARTER_DECK_IDS);
  return runDeckArr.every((card) => legacySet.has(card.id as (typeof LEGACY_STARTER_DECK_IDS)[number]));
}

function normalizeRunDeck(data: Record<string, unknown>, contentSystemType: ContentSystemId): unknown[] {
  const runDeckArr = Array.isArray(data.runDeck) ? (data.runDeck as Array<{ id: string }>) : [];
  const characterId = readString(data, "characterId", "");
  const preserveEmptyWildwoodDraft = contentSystemType === "wildwood" && Boolean(data.wildwoodDraft);
  if (
    (!preserveEmptyWildwoodDraft && runDeckArr.length === 0) ||
    (isUnstartedRun(data) && isLegacyStarterDeck(runDeckArr))
  ) {
    return characterId ? getStartingDeck(characterId as CharacterId) : [];
  }
  return runDeckArr;
}

function normalizeActiveCombat(
  data: Record<string, unknown>,
  contentSystemType: ContentSystemId,
): Record<string, unknown> | null {
  if (!data.activeCombat) return null;
  const combat = data.activeCombat as Record<string, unknown>;
  if (contentSystemType !== "labyrinth") {
    return { ...combat, activeLabyrinthModifiers: [], activeLabyrinthRewardModifiers: [] };
  }
  return {
    ...combat,
    activeLabyrinthModifiers: combat.activeLabyrinthModifiers ?? [],
    activeLabyrinthRewardModifiers: combat.activeLabyrinthRewardModifiers ?? [],
  };
}

export function normalizeActiveRunData<T extends Record<string, unknown>>(
  data: T,
): T & {
  contentSystemType: ContentSystemId;
  runPlayerHealth: number;
  completedDestinations: string[];
  runDeck: unknown;
  runTalentXP: TalentXP;
  runMaterialsEarned: MaterialInventory;
  labyrinthMap: unknown;
  labyrinthPendingNode: unknown;
  activeCombat: unknown;
} {
  const contentSystemType = computeContentSystemType(data);
  const runPlayerHealth = Math.min(data.runPlayerHealth as number, data.runMaxHealth as number);
  const completedDestinations = Array.isArray(data.completedDestinations)
    ? (data.completedDestinations as string[])
    : [];

  return {
    ...data,
    contentSystemType,
    runPlayerHealth,
    completedDestinations,
    runDeck: normalizeRunDeck(data, contentSystemType),
    runTalentXP: (data.runTalentXP as TalentXP | undefined) ?? {},
    runMaterialsEarned: (data.runMaterialsEarned as MaterialInventory | undefined) ?? emptyInventory(),
    labyrinthMap: contentSystemType === "labyrinth" ? data.labyrinthMap : null,
    labyrinthPendingNode: contentSystemType === "labyrinth" ? data.labyrinthPendingNode : null,
    wildwoodDraft: contentSystemType === "wildwood" ? data.wildwoodDraft : null,
    activeCombat: normalizeActiveCombat(data, contentSystemType),
  };
}
