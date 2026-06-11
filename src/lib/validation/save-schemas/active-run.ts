// Active run and mid-combat persistence schemas.
import { z } from "zod";
import { defaultBattleState, type BattleState } from "@/lib/battle";
import { isPersistedBattleState } from "../battle-state-guard";
import { ROUTE_SCREEN_VALUES } from "@/lib/routing";
import { ACTS_PER_RUN, LEGACY_CHARACTER_RENAMES } from "@/lib/game-constants";
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
  LabyrinthModifierArraySchema,
} from "./core";

const LabyrinthNodePositionSchema = z
  .object({ row: z.number().int().nonnegative(), col: z.number().int().nonnegative() })
  .nullable()
  .catch(null);

const ActiveCombatDataSchema = z
  .object({
    battleState: z.custom<BattleState>(isPersistedBattleState),
    activeLabyrinthModifiers: LabyrinthModifierArraySchema,
    activeLabyrinthRewardModifiers: LabyrinthModifierArraySchema,
  })
  .transform((data) => ({
    ...data,
    battleState: { ...defaultBattleState(), ...data.battleState } as BattleState,
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
    runTrinkets: caught(z.array(z.string()), [], "activeRun.runTrinkets"),
    encounteredRunEnemyIds: deduplicatedStringArraySchema("activeRun.encounteredRunEnemyIds").default([]),
    selectedDifficulty: caught(DifficultyIdSchema.nullable(), null, "activeRun.selectedDifficulty").default(null),
    contentSystemType: caught(
      z.preprocess((val) => (val === "wildwood" ? "campaign" : val), ContentSystemIdSchema),
      "campaign",
      "activeRun.contentSystemType",
    ),
    labyrinthMap: caught(LabyrinthMapSchema.nullable(), null, "activeRun.labyrinthMap"),
    labyrinthPendingNode: LabyrinthNodePositionSchema,
    activeCombat: caught(ActiveCombatDataSchema, null, "activeRun.activeCombat").default(null),
    runTalentXP: TalentXPSchema.optional(),
    currentScreen: caught(z.enum(ROUTE_SCREEN_VALUES).nullable(), null, "activeRun.currentScreen").default(null),
    destinationChoices: caught(z.array(z.string()), [], "activeRun.destinationChoices").default([]),
    discoveredCardIdsAtRunStart: deduplicatedStringArraySchema("activeRun.discoveredCardIdsAtRunStart").default([]),
    discoveredTrinketIdsAtRunStart: deduplicatedStringArraySchema("activeRun.discoveredTrinketIdsAtRunStart").default(
      [],
    ),
  })
  .transform((data) => normalizeActiveRunData(data))
  .refine((data) => data.contentSystemType !== "labyrinth" || data.labyrinthMap !== null, {
    message: "Labyrinth runs require a valid labyrinth map",
  });
