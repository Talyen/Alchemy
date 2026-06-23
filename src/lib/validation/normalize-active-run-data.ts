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

function computeContentSystemType(data: Record<string, unknown>): string {
  const raw = data.contentSystemType as string;
  if (raw === "labyrinth" && !data.labyrinthMap) return "campaign";
  return raw;
}

function readNumber(data: Record<string, unknown>, key: string, fallback: number): number {
  return typeof data[key] === "number" ? (data[key] as number) : fallback;
}

function readString(data: Record<string, unknown>, key: string, fallback: string): string {
  return typeof data[key] === "string" ? (data[key] as string) : fallback;
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

function normalizeRunDeck(data: Record<string, unknown>, contentSystemType: string): unknown[] {
  const runDeckArr = Array.isArray(data.runDeck) ? (data.runDeck as Array<{ id: string }>) : [];
  const characterId = readString(data, "characterId", "");
  const preserveEmptyWildwoodDraft = contentSystemType === "wildwood" && Boolean(data.wildwoodDraft);
  if (
    (!preserveEmptyWildwoodDraft && runDeckArr.length === 0) ||
    (isUnstartedRun(data) && isLegacyStarterDeck(runDeckArr))
  ) {
    return characterId ? getStartingDeck(characterId as import("@/lib/game-data").CharacterId) : [];
  }
  return runDeckArr;
}

function normalizeActiveCombat(
  data: Record<string, unknown>,
  contentSystemType: string,
): Record<string, unknown> | null {
  if (!data.activeCombat) return null;
  const combat = data.activeCombat as Record<string, unknown>;
  if (contentSystemType !== "labyrinth") {
    return { ...combat, activeLabyrinthModifiers: [], activeLabyrinthRewardModifiers: [] };
  }
  return {
    ...combat,
    activeLabyrinthModifiers: (combat.activeLabyrinthModifiers ?? []) as string[],
    activeLabyrinthRewardModifiers: (combat.activeLabyrinthRewardModifiers ?? []) as string[],
  };
}

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
    runTalentXP: (data.runTalentXP as Record<string, number> | undefined) ?? {},
    runMaterialsEarned: (data.runMaterialsEarned as MaterialInventory | undefined) ?? emptyInventory(),
    labyrinthMap: contentSystemType === "labyrinth" ? data.labyrinthMap : null,
    labyrinthPendingNode: contentSystemType === "labyrinth" ? data.labyrinthPendingNode : null,
    wildwoodDraft: contentSystemType === "wildwood" ? data.wildwoodDraft : null,
    activeCombat: normalizeActiveCombat(data, contentSystemType),
  };
}
