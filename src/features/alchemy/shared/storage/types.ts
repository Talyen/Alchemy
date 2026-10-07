import type { ActiveRunData } from "@/lib/active-run-session";
import type { GearSaveFields } from "../stores/gear-store-types";
import type { ProfileSaveFields } from "../stores/profile-store";
import type { RunProfileSaveFields } from "../stores/run-profile-codec";
import type { SettingsSaveFields } from "../stores/settings-store";

export type AlchemyPersistenceFields = SettingsSaveFields & ProfileSaveFields & GearSaveFields & RunProfileSaveFields;

export interface SaveData extends AlchemyPersistenceFields {
  steamAccountId: string | null;
  saveSchemaVersion: number;
  gameBuildVersion: string;
  contentVersion: number;
  activeRun: ActiveRunData | null;
  lastSavedAt: number;
}

/**
 * Snapshot assembled from stores before persistence. `lastSavedAt` is stamped
 * when SaveStorage serializes a payload. Builders never invent one.
 */
export type UnstampedSaveData = Omit<SaveData, "lastSavedAt">;
