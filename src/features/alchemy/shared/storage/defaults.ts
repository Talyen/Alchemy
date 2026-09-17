import type { SaveData } from "./types";
import { SaveDataSchema } from "@/lib/validation";
import { deepFreeze } from "../stores/store-utils";

// Single defaults owner: the Zod schema is the oracle so codec defaults,
// schema .catch defaults, and fixtures cannot drift. The contract test in
// save-migration-contract.test.ts pins this alignment. activeRun is null in
// defaults so no hydration (toActiveRunData) is required.
function parseDefaultSaveData(): SaveData {
  const parsed = SaveDataSchema.parse({});
  return { ...parsed, activeRun: null };
}

// Frozen in all builds: this singleton is spread into new sessions, so a prod
// mutation would leak into every later new game in the session.
export const defaultSaveData: SaveData = deepFreeze(parseDefaultSaveData());

export function createDefaultSaveData(): SaveData {
  // Clone the frozen singleton instead of re-parsing the full schema on every
  // load fallback: identical shape with fresh mutable containers per caller.
  return structuredClone(defaultSaveData);
}
