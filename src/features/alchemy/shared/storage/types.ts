import type { ActiveRunData } from "@/lib/active-run-session";
import type { GearSaveFields } from "../stores/gear-store-types";
import type { ProfileSaveFields } from "../stores/profile-store";
import type { RunProfileSaveFields } from "../stores/run-profile-codec";
import type { SettingsSaveFields } from "../stores/settings-store";

export type AlchemyPersistenceFields = SettingsSaveFields & ProfileSaveFields & GearSaveFields & RunProfileSaveFields;

export interface SaveData extends AlchemyPersistenceFields {
  saveSchemaVersion: number;
  gameBuildVersion: string;
  contentVersion: number;
  activeRun: ActiveRunData | null;
  lastSavedAt: number;
}
