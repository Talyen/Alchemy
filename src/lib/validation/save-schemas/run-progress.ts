import type { PersistedRunProgress } from "@/lib/active-run-session/run-progress";
import { ACTS_PER_RUN, MAX_PLAYER_HEALTH } from "@/lib/game-constants";
import { normalizeGearInstance } from "@/lib/gear/instance-normalization";
import { createRunRngState, type RunRngState } from "@/lib/rng";
import { DESTINATIONS } from "@/lib/routing";
import { z } from "zod";
import { savedCardArraySchema } from "./battle-card-schemas";
import { GearInstanceSchema } from "./gear-schemas";
import {
  CharacterIdSchema,
  ContentSystemIdSchema,
  CraftingCurrencyInventorySchema,
  DestinationArraySchema,
  DifficultyIdSchema,
  MaterialInventorySchema,
  TalentXPSchema,
} from "./schema-enums";
import { deduplicatedStringArraySchema, savedStringArraySchema } from "./validation-utils";
const RunObtainedGearItemSchema = z.object({
  kind: z.literal("gear"),
  instance: GearInstanceSchema,
});
const RunObtainedTrinketItemSchema = z.object({
  kind: z.literal("trinket"),
  trinketId: z.string().min(1),
});
const RunObtainedItemSchema = z.discriminatedUnion("kind", [RunObtainedGearItemSchema, RunObtainedTrinketItemSchema]);

function normalizeRunObtainedItems(raw: unknown): Array<z.infer<typeof RunObtainedItemSchema>> {
  if (!Array.isArray(raw)) return [];
  // Canonical single-item normalizer is normalizeGearInstance from
  // gear/instance-normalization (same as normalizeGearInstanceArray uses); the loop below
  // preserves original order while dropping invalid gear, which the array
  // wrapper alone cannot do for this heterogeneous list.
  const items: Array<z.infer<typeof RunObtainedItemSchema>> = [];
  for (const entry of raw) {
    if (!entry || typeof entry !== "object") continue;
    const record = entry as { kind?: unknown; instance?: unknown; trinketId?: unknown };
    if (record.kind === "gear") {
      const instance = normalizeGearInstance(record.instance);
      if (instance) items.push({ kind: "gear", instance });
      continue;
    }
    if (record.kind === "trinket" && typeof record.trinketId === "string" && record.trinketId.length > 0) {
      items.push({ kind: "trinket", trinketId: record.trinketId });
    }
  }
  return items;
}

const RunObtainedItemArraySchema = z.preprocess(normalizeRunObtainedItems, z.array(RunObtainedItemSchema));

// Fresh fallback per use: stepRunRng advances counters in place, so sharing
// one frozen object across parses would hand live runs an unusable state.
function createFallbackRunRngState(): RunRngState {
  return createRunRngState(1);
}

const RunRngStateSchema = z
  .object({
    seed: z.number().int().nonnegative().max(0xffff_ffff),
    counters: z
      .object({
        rewards: z.number().int().nonnegative().catch(0),
        destinations: z.number().int().nonnegative().catch(0),
        events: z.number().int().nonnegative().catch(0),
        shops: z.number().int().nonnegative().catch(0),
        world: z.number().int().nonnegative().catch(0),
      })
      .catch({ rewards: 0, destinations: 0, events: 0, shops: 0, world: 0 }),
  })
  .catch(createFallbackRunRngState);

export const RunProgressSchema = z.object({
  runHistory: z
    .array(
      z.object({
        id: z.string().min(1),
        destination: z.enum(Object.values(DESTINATIONS)),
        act: z.number().int().positive(),
        floor: z.number().int().positive().nullable(),
        completed: z.boolean(),
      }),
    )
    .catch([]),
  runHistoryPartial: z.boolean().catch(true),
  runGoldEarned: z.number().int().nonnegative().nullable().catch(null),
  characterId: CharacterIdSchema,
  runDeck: savedCardArraySchema("runDeck"),
  // Invalid Health uses the same sentinel as zero; normalization repairs it to the saved maximum.
  runPlayerHealth: z.number().int().nonnegative().catch(0),
  runMaxHealth: z.number().int().positive().catch(MAX_PLAYER_HEALTH),
  // A zero runMetaMaxHealth means "unset" and is rewritten to runMaxHealth in
  // normalizeActiveRunData; the catch keeps the sentinel, it is not a default.
  runMetaMaxHealth: z.number().int().nonnegative().catch(0),
  roomsEncountered: z.number().int().nonnegative().catch(0),
  currentAct: z.number().int().min(1).max(ACTS_PER_RUN).catch(1),
  destinationIndexInAct: z.number().int().nonnegative().catch(0),
  completedDestinations: DestinationArraySchema,
  lastOfferedDestinations: DestinationArraySchema,
  destinationRoundsSinceOffered: z.preprocess(
    (value) => {
      if (!value || typeof value !== "object" || Array.isArray(value)) return {};
      return Object.fromEntries(
        Object.entries(value).filter(
          (entry): entry is [string, number] =>
            typeof entry[1] === "number" && Number.isSafeInteger(entry[1]) && entry[1] >= 0,
        ),
      );
    },
    z.record(z.string(), z.number().int().nonnegative()),
  ),
  runBoons: savedStringArraySchema().catch([]),
  encounteredRunEnemyIds: deduplicatedStringArraySchema(),
  selectedDifficulty: DifficultyIdSchema.nullable().catch(null),
  contentSystemType: ContentSystemIdSchema.catch("campaign"),
  rng: RunRngStateSchema.default(createFallbackRunRngState),
  runTalentXP: TalentXPSchema,
  runMaterialsEarned: MaterialInventorySchema,
  runCurrenciesEarned: CraftingCurrencyInventorySchema,
  runObtainedItems: RunObtainedItemArraySchema,
} satisfies { [K in keyof PersistedRunProgress]: z.ZodType<PersistedRunProgress[K]> });
