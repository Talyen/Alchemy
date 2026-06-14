// Active run and mid-combat persistence schemas.
import { z } from "zod";
import { defaultBattleState, type BattleState } from "@/lib/battle";
import { computeBoonManifest, isDefaultBoonManifest } from "@/lib/boons";
import { isPersistedBattleState } from "../battle-state-guard";
import { ROUTE_SCREEN_VALUES } from "@/lib/routing";
import { ACTS_PER_RUN, LEGACY_CHARACTER_RENAMES } from "@/lib/game-constants";
import { WILDWOOD_BOSS_IDS } from "@/lib/content-systems/wildwood/bosses";
import { sanitizeEncounterTraitIds, sanitizePersistedEnemyTraits } from "@/lib/content-systems/encounter-traits";
import { normalizeActiveRunData } from "../normalize-active-run-data";
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
        boonEffects: saved.boonEffects ?? defaults.boonEffects,
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
    rewardType: z.enum(["card", "boon"]).nullable(),
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
    runBoons: caught(z.array(z.string()), [], "activeRun.runBoons"),
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
    discoveredCardIdsAtRunStart: deduplicatedStringArraySchema("activeRun.discoveredCardIdsAtRunStart").default([]),
    discoveredBoonIdsAtRunStart: deduplicatedStringArraySchema("activeRun.discoveredBoonIdsAtRunStart").default([]),
  })
  .transform((data) => normalizeActiveRunData(data))
  .transform((data) => {
    if (!data.activeCombat?.battleState || data.runBoons.length === 0) return data;
    const battleState = data.activeCombat.battleState;
    if (!isDefaultBoonManifest(battleState.boonEffects)) return data;
    return {
      ...data,
      activeCombat: {
        ...data.activeCombat,
        battleState: {
          ...battleState,
          boonEffects: computeBoonManifest(data.runBoons),
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
