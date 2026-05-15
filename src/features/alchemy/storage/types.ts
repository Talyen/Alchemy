// Save-data types for settings, collection, run, talents, and homestead state.
// Depends on character game data plus talent, homestead, run, and option type contracts.
import type { TalentXP } from "@/lib/talents";
import type { BuildingId, FarmId, MaterialInventory, ResearchId } from "@/lib/homestead/types";
import type { CharacterId, DifficultyId, UnlockedTalents } from "@/lib/game-data";
import type { ActiveRunData } from "../run/types";
import type { DisplayMode, ResolutionOption, UiScale } from "../types";

export type SaveData = {
  selectedResolution: ResolutionOption;
  displayMode: DisplayMode;
  uiScale: UiScale;
  brightness: number;
  discoveredCardIds: string[];
  encounteredEnemyIds: string[];
  discoveredTrinketIds: string[];
  talentXP: TalentXP;
  unlockedTalents: UnlockedTalents;
  musicVolume: number;
  sfxVolume: number;
  masterVolume: number;
  muteInBackground: boolean;
  autoEndTurn: boolean;
  activeRun: ActiveRunData | null;
  materialInventory: MaterialInventory;
  constructedBuildings: BuildingId[];
  plantedFarms: FarmId[];
  completedResearch: ResearchId[];
  completedDifficulties: Record<CharacterId, DifficultyId[]>;
};
