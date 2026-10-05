import type { DemoImportSource } from "@/lib/desktop-api";
import { createDefaultGearSaveFields } from "../stores/gear-actions";
import { createDefaultProfileSaveFields } from "../stores/profile-store-types";
import { RUN_PROFILE_SAVE_KEYS } from "../stores/run-profile-save-fields";
import { createDefaultSaveData } from "./defaults";
import { selectSaveCandidates } from "./save-candidates";
import type { SaveData, UnstampedSaveData } from "./types";
export type { DemoImportSource } from "@/lib/desktop-api";

/** Copy one validated profile, never add currencies or replay run settlement. */
export function prepareDemoProgressImport(source: DemoImportSource): UnstampedSaveData | null {
  if (source.initialized || source.fullSaveExists || source.readFailed || source.candidates.length === 0) return null;
  const { state: loaded, useRecovery } = selectSaveCandidates(source.candidates);
  // Any newer-format source protects the demo profile, even alongside a usable backup.
  if (useRecovery || loaded.status.kind !== "ok") return null;
  const result = createDefaultSaveData();
  result.steamAccountId = loaded.data.steamAccountId;
  const keys = [
    ...RUN_PROFILE_SAVE_KEYS,
    ...Object.keys(createDefaultProfileSaveFields()).filter((key) => key !== "completedDifficulties"),
    ...Object.keys(createDefaultGearSaveFields()),
  ] as Array<keyof SaveData>;
  // Field owners define the permanent profile; settings and activity are excluded.
  for (const key of keys) Object.assign(result, { [key]: structuredClone(loaded.data[key]) });
  const { lastSavedAt: _savedAt, ...snapshot } = result;
  void _savedAt;
  return snapshot;
}
