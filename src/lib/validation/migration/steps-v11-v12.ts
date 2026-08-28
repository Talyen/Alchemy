import type { RawSaveData } from "./types";

const CHARACTER_IDS = ["knight", "rogue", "wizard", "ranger", "alchemist", "warlock", "druid", "wildcard"];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function migratePendingReward(value: unknown): unknown {
  if (!isRecord(value)) return value;
  return value.rewardType === "trinket" ? { ...value, rewardType: "boon" } : value;
}

function migrateInterruptedFlow(value: unknown): unknown {
  if (!isRecord(value) || (value.kind !== "primary-reward" && value.kind !== "companion-reward")) return value;
  return { ...value, pending: migratePendingReward(value.pending) };
}

function migrateRun(value: unknown): unknown {
  if (!isRecord(value)) return value;
  const { runTrinkets, ...rest } = value;
  const hasBoonField = Array.isArray(runTrinkets) || Array.isArray(value.runBoons);
  const hasWildwoodDraft = Object.hasOwn(value, "wildwoodDraft");
  const hasInterruptedFlow = Object.hasOwn(value, "interruptedFlow");
  const wildwoodDraft =
    isRecord(value.wildwoodDraft) && value.wildwoodDraft.rewardType === "trinket"
      ? { ...value.wildwoodDraft, rewardType: "boon" }
      : value.wildwoodDraft;
  return {
    ...rest,
    ...(hasBoonField
      ? { runBoons: Array.isArray(runTrinkets) ? runTrinkets : Array.isArray(value.runBoons) ? value.runBoons : [] }
      : {}),
    ...(hasWildwoodDraft ? { wildwoodDraft } : {}),
    ...(hasInterruptedFlow ? { interruptedFlow: migrateInterruptedFlow(value.interruptedFlow) } : {}),
  };
}

function migrateGearLoadouts(value: unknown): unknown {
  if (!isRecord(value)) return value;
  return Object.fromEntries(
    Object.entries(value).map(([characterId, rawLoadout]) => {
      if (!isRecord(rawLoadout)) return [characterId, rawLoadout];
      return [
        characterId,
        {
          "main-hand": rawLoadout["main-hand"] ?? null,
          "off-hand": rawLoadout["off-hand"] ?? null,
          body: rawLoadout.body ?? null,
          "left-accessory": rawLoadout["left-ring"] ?? rawLoadout["left-accessory"] ?? null,
          "right-accessory": rawLoadout.amulet ?? rawLoadout["right-accessory"] ?? null,
        },
      ];
    }),
  );
}

export function migrateV11ToV12(save: RawSaveData): RawSaveData {
  const parkedRuns = isRecord(save.parkedRuns)
    ? Object.fromEntries(Object.entries(save.parkedRuns).map(([mode, run]) => [mode, migrateRun(run)]))
    : save.parkedRuns;
  return {
    ...save,
    activeRun: migrateRun(save.activeRun),
    parkedRuns,
    gearLoadouts: migrateGearLoadouts(save.gearLoadouts),
    ownedTrinketIds: Array.isArray(save.ownedTrinketIds) ? save.ownedTrinketIds : [],
    equippedTrinkets: isRecord(save.equippedTrinkets)
      ? save.equippedTrinkets
      : Object.fromEntries(CHARACTER_IDS.map((id) => [id, null])),
  };
}
