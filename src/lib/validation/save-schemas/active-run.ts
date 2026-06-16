// Active run and mid-combat persistence schemas.
import { z } from "zod";
import { defaultBattleState, type BattleState } from "@/lib/battle";
import { computeTrinketManifest, isDefaultTrinketManifest } from "@/lib/trinkets";
import { isPersistedBattleState } from "../battle-state-guard";
import { ROUTE_SCREEN_VALUES } from "@/lib/routing";
import { ACTS_PER_RUN, LEGACY_CHARACTER_RENAMES } from "@/lib/game-constants";
import { WILDWOOD_BOSS_IDS } from "@/lib/content-systems/wildwood/bosses";
import { sanitizeEncounterTraitIds, sanitizePersistedEnemyTraits } from "@/lib/content-systems/encounter-traits";
import { normalizeActiveRunData } from "../normalize-active-run-data";
import { GEAR_AFFIX_IDS } from "@/lib/gear/affix-ids";
import { GEAR_DEFINITION_IDS } from "@/lib/gear/definitions";
import { normalizeGearInstance } from "@/lib/gear/operations";
import { emptyInventory } from "@/lib/homestead/inventory";
import {
  caught,
  deduplicatedStringArraySchema,
  CharacterIdSchema,
  ContentSystemIdSchema,
  DifficultyIdSchema,
  TalentXPSchema,
  BattleCardSchema,
  LabyrinthMapSchema,
  EncounterCombatTraitArraySchema,
  EncounterRewardTraitArraySchema,
  MaterialInventorySchema,
} from "./core";

const LabyrinthNodePositionSchema = z
  .object({ row: z.number().int().nonnegative(), col: z.number().int().nonnegative() })
  .nullable()
  .catch(null);

const ActiveCombatDataSchema = z
  .object({
    battleState: z.custom<BattleState>(isPersistedBattleState),
    activeLabyrinthModifiers: EncounterCombatTraitArraySchema,
    activeLabyrinthRewardModifiers: EncounterRewardTraitArraySchema,
  })
  .transform((data) => {
    const defaults = defaultBattleState();
    const saved = data.battleState;
    return {
      ...data,
      battleState: {
        ...defaults,
        ...saved,
        trinketEffects: saved.trinketEffects ?? defaults.trinketEffects,
        gearEffects: saved.gearEffects ?? defaults.gearEffects,
        flags: { ...defaults.flags, ...saved.flags },
        currentEnemy: {
          ...saved.currentEnemy,
          traits: sanitizePersistedEnemyTraits(
            Array.isArray(saved.currentEnemy.traits) ? saved.currentEnemy.traits : [],
          ),
        },
      } as BattleState,
    };
  })
  .nullable()
  .catch(null);

const WildwoodBossIdSchema = z.enum(WILDWOOD_BOSS_IDS);
const WildwoodDraftStateSchema = z
  .object({
    version: z.literal(2),
    phase: z.enum(["draft", "battle", "recovery", "reward", "removal"]),
    draftChoices: z.array(BattleCardSchema),
    remainingBossIds: z.array(WildwoodBossIdSchema),
    previousBossId: WildwoodBossIdSchema.nullable(),
    currentBossId: WildwoodBossIdSchema.nullable(),
    currentCombatTraitIds: z.array(z.string()).default([]),
    currentRewardTraitIds: z.array(z.string()).default([]),
    rewardType: z.enum(["card", "trinket"]).nullable(),
    rewardChoiceIds: z.array(z.string()),
    selectedRewardId: z.string().nullable(),
  })
  .transform((state) => ({
    ...state,
    currentCombatTraitIds: sanitizeEncounterTraitIds(state.currentCombatTraitIds, "combat"),
    currentRewardTraitIds: sanitizeEncounterTraitIds(state.currentRewardTraitIds, "reward"),
  }))
  .nullable()
  .catch(null);

const GearInstanceSchema = z.object({
  instanceId: z.string().min(1),
  definitionId: z.enum(GEAR_DEFINITION_IDS),
  affixIds: z.array(z.enum(GEAR_AFFIX_IDS)),
});

const PersistedPendingRewardBaseSchema = {
  selectedId: caught(z.string().nullable(), null, "activeRun.pendingReward.selectedId"),
  gold: caught(z.number().int().nonnegative(), 0, "activeRun.pendingReward.gold"),
  materials: caught(MaterialInventorySchema, emptyInventory(), "activeRun.pendingReward.materials"),
  destinations: caught(z.array(z.string()), [], "activeRun.pendingReward.destinations"),
  selectedBossId: caught(z.string().nullable(), null, "activeRun.pendingReward.selectedBossId"),
  lastVictoryEnemyType: caught(z.string().nullable(), null, "activeRun.pendingReward.lastVictoryEnemyType"),
  lastVictoryContentSystem: caught(
    ContentSystemIdSchema.nullable(),
    null,
    "activeRun.pendingReward.lastVictoryContentSystem",
  ),
};

const PersistedPendingRewardSchema = z
  .preprocess(
    (raw) => {
      if (!raw || typeof raw !== "object") return raw;
      const item = raw as Record<string, unknown>;
      if (item.rewardType === "boon") return { ...item, rewardType: "trinket" };
      return raw;
    },
    z.discriminatedUnion("rewardType", [
      z.object({
        rewardType: z.literal("card"),
        choiceIds: z.array(z.string()),
        ...PersistedPendingRewardBaseSchema,
      }),
      z.object({
        rewardType: z.literal("trinket"),
        choiceIds: z.array(z.string()),
        ...PersistedPendingRewardBaseSchema,
      }),
      z.object({
        rewardType: z.literal("gear"),
        gearChoices: z.preprocess(
          (raw) =>
            Array.isArray(raw)
              ? raw.flatMap((item) => {
                  const normalized = normalizeGearInstance(
                    item && typeof item === "object" ? (item as Record<string, unknown>) : {},
                  );
                  return normalized ? [normalized] : [];
                })
              : raw,
          z.array(GearInstanceSchema),
        ),
        ...PersistedPendingRewardBaseSchema,
      }),
    ]),
  )
  .nullable()
  .catch(null);

// ===== ActiveRunData =====
// normalizeActiveRunData lives in ./normalize-active-run-data.ts — imported above.

export const ActiveRunDataSchema = z
  .object({
    characterId: z.preprocess((val) => {
      if (typeof val === "string" && val in LEGACY_CHARACTER_RENAMES) {
        return LEGACY_CHARACTER_RENAMES[val as keyof typeof LEGACY_CHARACTER_RENAMES];
      }
      return val;
    }, CharacterIdSchema),
    runDeck: z.array(BattleCardSchema),
    runGold: caught(z.number().int().nonnegative(), 0, "activeRun.runGold"),
    runPlayerHealth: caught(z.number().int().nonnegative(), 0, "activeRun.runPlayerHealth"),
    runMaxHealth: caught(z.number().int().positive(), 30, "activeRun.runMaxHealth"),
    roomsEncountered: caught(z.number().int().nonnegative(), 0, "activeRun.roomsEncountered"),
    currentAct: caught(z.number().int().min(1).max(ACTS_PER_RUN), 1, "activeRun.currentAct"),
    destinationIndexInAct: caught(z.number().int().nonnegative(), 0, "activeRun.destinationIndexInAct"),
    completedDestinations: caught(z.array(z.string()), [], "activeRun.completedDestinations"),
    runTrinkets: caught(z.array(z.string()), [], "activeRun.runTrinkets"),
    encounteredRunEnemyIds: deduplicatedStringArraySchema("activeRun.encounteredRunEnemyIds").default([]),
    selectedDifficulty: caught(DifficultyIdSchema.nullable(), null, "activeRun.selectedDifficulty").default(null),
    contentSystemType: caught(ContentSystemIdSchema, "campaign", "activeRun.contentSystemType"),
    labyrinthMap: caught(LabyrinthMapSchema.nullable(), null, "activeRun.labyrinthMap"),
    labyrinthPendingNode: LabyrinthNodePositionSchema,
    wildwoodDraft: WildwoodDraftStateSchema.default(null),
    activeCombat: caught(ActiveCombatDataSchema, null, "activeRun.activeCombat").default(null),
    runTalentXP: TalentXPSchema.optional(),
    runMaterialsEarned: MaterialInventorySchema.optional(),
    currentScreen: caught(z.enum(ROUTE_SCREEN_VALUES).nullable(), null, "activeRun.currentScreen").default(null),
    destinationChoices: caught(z.array(z.string()), [], "activeRun.destinationChoices").default([]),
    pendingReward: caught(PersistedPendingRewardSchema, null, "activeRun.pendingReward").default(null),
  })
  .transform((data) => normalizeActiveRunData(data))
  .transform((data) => {
    if (!data.activeCombat?.battleState || data.runTrinkets.length === 0) return data;
    const battleState = data.activeCombat.battleState;
    if (!isDefaultTrinketManifest(battleState.trinketEffects)) return data;
    return {
      ...data,
      activeCombat: {
        ...data.activeCombat,
        battleState: {
          ...battleState,
          trinketEffects: computeTrinketManifest(data.runTrinkets),
        },
      },
    };
  })
  .refine((data) => data.contentSystemType !== "labyrinth" || data.labyrinthMap !== null, {
    message: "Labyrinth runs require a valid labyrinth map",
  })
  .refine((data) => data.contentSystemType !== "wildwood" || data.wildwoodDraft !== null, {
    message: "Wildwood Draft runs require versioned mode state",
  });
