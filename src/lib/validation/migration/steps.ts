import { CURRENT_CONTENT_VERSION, CURRENT_GAME_BUILD_VERSION } from "../metadata";
import { migrateSaveTopLevelV4 } from "./migrate-save-top-level";
import { migrateSaveTopLevelV5 } from "./migrate-save-top-level-v5";
import type { RawSaveData } from "./types";
import { normalizePositiveInteger } from "./types";
import { EMPTY_CRAFTING_CURRENCIES } from "@/lib/gear";

// Maps old fixed-resolution strings (v0 save format) to the canonical aspect-ratio values
// used in v1+. Only runs after schema migration so the field is already at its new name.
const LEGACY_RESOLUTION_TO_ASPECT_RATIO = {
  "1920x1080": "16:9",
  "1920x1200": "16:10",
  "2560x1080": "21:9",
} as const;

function remapArrowKeywordProgress(record: Record<string, unknown> | undefined): Record<string, unknown> {
  if (!record || typeof record !== "object") return {};
  const next: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(record)) {
    if (key === "arrow") continue;
    next[key] = value;
  }
  if ("arrow" in record) {
    const archeryValue = record.archery;
    const arrowValue = record.arrow;
    if (typeof archeryValue === "number" && typeof arrowValue === "number") {
      next.archery = archeryValue + arrowValue;
    } else if (archeryValue !== undefined) {
      next.archery = archeryValue;
    } else if (arrowValue !== undefined) {
      next.archery = arrowValue;
    }
  }
  return next;
}

function remapArrowTalentId(id: string): string {
  if (id === "arrow-damage") return "archery-damage";
  const placeholderMatch = /^arrow-placeholder-(\d+)$/.exec(id);
  if (placeholderMatch) return `archery-placeholder-${placeholderMatch[1]}`;
  if (id.startsWith("arrow-")) return `archery-${id.slice("arrow-".length)}`;
  return id;
}

function remapArrowUnlockedTalents(record: Record<string, unknown> | undefined): Record<string, unknown> {
  if (!record || typeof record !== "object") return {};
  const next: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(record)) {
    if (key === "arrow") continue;
    next[key] = value;
  }
  const arrowIds = record.arrow;
  const archeryIds = Array.isArray(record.archery)
    ? record.archery.filter((id): id is string => typeof id === "string")
    : [];
  const mergedIds = [
    ...archeryIds,
    ...(Array.isArray(arrowIds)
      ? arrowIds.filter((id): id is string => typeof id === "string").map(remapArrowTalentId)
      : []),
  ];
  if (mergedIds.length > 0) {
    next.archery = Array.from(new Set(mergedIds.filter((id): id is string => typeof id === "string")));
  }
  return next;
}

// Converts persisted selectedResolution → selectedAspectRatio for saves predating the v1
// aspect-ratio picker. If neither field is a string the save is left unchanged (Zod .catch
// will supply the "auto" default during parsing).
export function normalizeLegacyAspectRatio(parsed: RawSaveData): RawSaveData {
  if (typeof parsed.selectedAspectRatio === "string") return parsed;
  if (typeof parsed.selectedResolution !== "string") return parsed;
  const selectedAspectRatio =
    LEGACY_RESOLUTION_TO_ASPECT_RATIO[parsed.selectedResolution as keyof typeof LEGACY_RESOLUTION_TO_ASPECT_RATIO];
  return { ...parsed, selectedAspectRatio };
}

// V0 saves predate schema-version tracking; they lack gameBuildVersion and contentVersion.
export function migrateV0ToV1(parsed: RawSaveData): RawSaveData {
  return {
    ...parsed,
    saveSchemaVersion: 1,
    gameBuildVersion:
      typeof parsed.gameBuildVersion === "string" ? parsed.gameBuildVersion : CURRENT_GAME_BUILD_VERSION,
    contentVersion: normalizePositiveInteger(parsed.contentVersion, CURRENT_CONTENT_VERSION),
  };
}

export function migrateV1ToV2(parsed: RawSaveData): RawSaveData {
  return {
    ...parsed,
    saveSchemaVersion: 2,
    talentXP: remapArrowKeywordProgress(parsed.talentXP as Record<string, unknown> | undefined),
    unlockedTalents: remapArrowUnlockedTalents(parsed.unlockedTalents as Record<string, unknown> | undefined),
    runTalentXP:
      parsed.runTalentXP !== undefined
        ? remapArrowKeywordProgress(parsed.runTalentXP as Record<string, unknown> | undefined)
        : parsed.runTalentXP,
  };
}

export function migrateV2ToV3(parsed: RawSaveData): RawSaveData {
  return {
    ...parsed,
    saveSchemaVersion: 3,
    finishedRunCharacters: Array.isArray(parsed.finishedRunCharacters) ? parsed.finishedRunCharacters : [],
  };
}

export function migrateV3ToV4(parsed: RawSaveData): RawSaveData {
  return {
    ...migrateSaveTopLevelV4(parsed),
    saveSchemaVersion: 4,
  };
}

export function migrateV4ToV5(parsed: RawSaveData): RawSaveData {
  return {
    ...migrateSaveTopLevelV5(parsed),
    saveSchemaVersion: 5,
  };
}

const SCALE_1_AFFIXES = new Set([
  "poison-leech",
  "physical-bleed-chance",
  "physical-stun-chance",
  "nature-leech",
  "companion-forge-power",
]);

function migrateGearInstance(item: Record<string, unknown>): Record<string, unknown> {
  const definitionId = item.definitionId;
  if (typeof definitionId !== "string") return item;

  const isAstral = definitionId.endsWith("-astral");
  if (!isAstral) return item;

  const affixes = item.affixes;
  if (!Array.isArray(affixes)) return item;

  const affixList: unknown[] = affixes;
  const migratedAffixes = affixList.map((affix) => {
    if (!affix || typeof affix !== "object") return affix;
    const a = affix as Record<string, unknown>;
    const id = a.id;
    const value = a.value;
    if (typeof id !== "string" || typeof value !== "number") return affix;

    const scale = SCALE_1_AFFIXES.has(id) ? 1 : 2;
    return {
      ...a,
      value: Math.max(0, Math.round(value * scale)),
    };
  });

  return {
    ...item,
    affixes: migratedAffixes,
  };
}

function migrateGearArray(raw: unknown): unknown[] | undefined {
  if (!Array.isArray(raw)) return undefined;
  const items: unknown[] = raw;
  return items.map((item) =>
    item && typeof item === "object" ? migrateGearInstance(item as Record<string, unknown>) : item,
  );
}

function migrateActiveRunGear(activeRun: Record<string, unknown>): Record<string, unknown> {
  const run = { ...activeRun };
  if (run.equipmentShopState && typeof run.equipmentShopState === "object") {
    const shopState = { ...(run.equipmentShopState as Record<string, unknown>) };
    const migrated = migrateGearArray(shopState.gear);
    if (migrated) shopState.gear = migrated;
    run.equipmentShopState = shopState;
  }
  if (run.pendingReward && typeof run.pendingReward === "object") {
    const reward = { ...(run.pendingReward as Record<string, unknown>) };
    if (reward.rewardType === "gear") {
      const migrated = migrateGearArray(reward.gearChoices);
      if (migrated) reward.gearChoices = migrated;
    }
    run.pendingReward = reward;
  }
  if (run.wildwoodDraft && typeof run.wildwoodDraft === "object") {
    const draft = { ...(run.wildwoodDraft as Record<string, unknown>) };
    const migrated = migrateGearArray(draft.rewardGearChoices);
    if (migrated) draft.rewardGearChoices = migrated;
    run.wildwoodDraft = draft;
  }
  return run;
}

export function migrateV5ToV6(parsed: RawSaveData): RawSaveData {
  const next = { ...parsed };
  const migratedInventory = migrateGearArray(next.gearInventory);
  if (migratedInventory) next.gearInventory = migratedInventory;
  if (next.activeRun && typeof next.activeRun === "object") {
    next.activeRun = migrateActiveRunGear(next.activeRun as Record<string, unknown>);
  }
  return { ...next, saveSchemaVersion: 6 };
}

export function migrateV6ToV7(parsed: RawSaveData): RawSaveData {
  return {
    ...parsed,
    craftingCurrencies:
      parsed.craftingCurrencies !== undefined ? parsed.craftingCurrencies : { ...EMPTY_CRAFTING_CURRENCIES },
    saveSchemaVersion: 7,
  };
}

export function migrateV7ToV8(parsed: RawSaveData): RawSaveData {
  return {
    ...parsed,
    craftingCurrencyBoardPositions:
      parsed.craftingCurrencyBoardPositions !== undefined ? parsed.craftingCurrencyBoardPositions : {},
    saveSchemaVersion: 8,
  };
}

export {
  migrateV8ToV9,
  migrateV9ToV10,
  readLegacyArmoryBoardPositionsFromStorage,
  LEGACY_ARMORY_POSITIONS_STORAGE_KEY,
} from "./steps-gear-layout";
