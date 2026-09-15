import type { SaveData } from "./types";
import { SaveDataSchema } from "@/lib/validation";
import { deepFreezeInDev } from "../stores/store-utils";

// Single defaults owner: the Zod schema is the oracle so codec defaults,
// schema .catch defaults, and fixtures cannot drift. The contract test in
// save-migration-contract.test.ts pins this alignment. activeRun is null in
// defaults so no hydration (toActiveRunData) is required.
export function createDefaultSaveData(): SaveData {
  const parsed = SaveDataSchema.parse({});
  return { ...parsed, activeRun: null };
}

export const defaultSaveData: SaveData = createDefaultSaveData();

deepFreezeInDev(defaultSaveData);
