import type { DemoImportSource } from "@/lib/desktop-api";
export type { DemoImportSource } from "@/lib/desktop-api";
import { createDefaultSaveData } from "./defaults";
import { evaluateSaveCandidates, hasUnsupportedFutureCandidate } from "./save-candidates";
import type { SaveData, UnstampedSaveData } from "./types";
import { RUN_PROFILE_SAVE_KEYS } from "../stores/run-profile-codec";
import { profilePersistenceCodec } from "../stores/profile-store";
import { gearPersistenceCodec } from "../stores/gear-store";

/** Copy one validated profile, never add currencies or replay run settlement. */
export function prepareDemoProgressImport(source: DemoImportSource): UnstampedSaveData | null {
  if (
    source.initialized ||
    source.fullSaveExists ||
    source.readFailed ||
    source.candidates.length === 0 ||
    hasUnsupportedFutureCandidate(source.candidates)
  )
    return null;
  const loaded = evaluateSaveCandidates(source.candidates);
  if (loaded.status.kind !== "ok") return null;
  const result = createDefaultSaveData();
  result.steamAccountId = loaded.data.steamAccountId;
  const keys = [
    ...RUN_PROFILE_SAVE_KEYS,
    ...Object.keys(profilePersistenceCodec.createDefault()).filter((key) => key !== "completedDifficulties"),
    ...Object.keys(gearPersistenceCodec.createDefault()),
  ] as Array<keyof SaveData>;
  // Field owners define the permanent profile; settings and activity are excluded.
  for (const key of keys) Object.assign(result, { [key]: structuredClone(loaded.data[key]) });
  const { lastSavedAt: _savedAt, ...snapshot } = result;
  void _savedAt;
  return snapshot;
}
