// Save envelope composed from store-owned persistence field contracts.
import type { ActiveRunData } from "@/lib/active-run-session";
import type { GearSaveFields } from "../stores/gear-store-types";
import type { ProfileSaveFields } from "../stores/profile-store";
import type { RunProfileSaveFields } from "../stores/run-save-readers";
import type { SettingsSaveFields } from "../stores/settings-store";

export interface SaveData extends SettingsSaveFields, ProfileSaveFields, GearSaveFields, RunProfileSaveFields {
  saveSchemaVersion: number;
  gameBuildVersion: string;
  contentVersion: number;
  activeRun: ActiveRunData | null;
  lastSavedAt: number;
}
