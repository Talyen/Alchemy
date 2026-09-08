import type { ActiveRunData } from "@/lib/active-run-session";
import type { ContentSystemId } from "@/lib/content-systems/types";
import type { GearSaveFields } from "../stores/gear-store-types";
import type { ProfileSaveFields } from "../stores/profile-store";
import type { RunProfileSaveFields } from "../stores/run-profile-codec";
import type { SettingsSaveFields } from "../stores/settings-store";
import type { ParkedRunsMap } from "@/lib/active-run-session";

export type AlchemyPersistenceFields = SettingsSaveFields & ProfileSaveFields & GearSaveFields & RunProfileSaveFields;

export interface SaveData extends AlchemyPersistenceFields {
  saveSchemaVersion: number;
  gameBuildVersion: string;
  contentVersion: number;
  activeRun: ActiveRunData | null;
  parkedRuns: ParkedRunsMap;
  runRecency: ContentSystemId[];
  lastSavedAt: number;
}
