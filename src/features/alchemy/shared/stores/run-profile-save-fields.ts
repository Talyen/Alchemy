import type { PermanentProgressFields } from "./run-state-init";
export type RunProfileSaveFields = Omit<PermanentProgressFields, "effects">;

// Explicit save shape: adding a field to PermanentProgressFields fails the
// exhaustiveness check below until the save contract is updated deliberately.
// `effects` is derived on hydrate and never persisted.
export const RUN_PROFILE_SAVE_KEYS = [
  "gold",
  "talentXP",
  "unlockedTalents",
  "materialInventory",
  "constructedBuildings",
  "plantedFarms",
  "completedResearch",
  "bondedCompanions",
] as const satisfies ReadonlyArray<keyof RunProfileSaveFields>;

type MissingSaveKeys = Exclude<keyof RunProfileSaveFields, (typeof RUN_PROFILE_SAVE_KEYS)[number]>;
const _assertAllSaveKeysListed: MissingSaveKeys extends never ? true : never = true;
void _assertAllSaveKeysListed;
