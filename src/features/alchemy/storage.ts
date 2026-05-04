import { starterDeck, type CharacterGender, type CharacterId } from "@/lib/game-data";
import type { TalentXP } from "@/lib/talents";

import type { UnlockedTalents } from "./talent-pool";
import type { ResolutionOption } from "./types";
import { SAVE_KEY } from "@/lib/game-constants";

const storageKey = SAVE_KEY;

type SaveData = {
  selectedResolution: ResolutionOption;
  discoveredCardIds: string[];
  encounteredEnemyIds: string[];
  discoveredTrinketIds: string[];
  talentXP: TalentXP;
  unlockedTalents: UnlockedTalents;
  musicVolume: number;
  sfxVolume: number;
  activeRun: ActiveRunData | null;
};

type ActiveRunData = {
  characterId: CharacterId;
  characterGender: CharacterGender;
};

export const defaultSaveData: SaveData = {
  selectedResolution: "1920x1080",
  discoveredCardIds: starterDeck.map((card) => card.id),
  encounteredEnemyIds: [],
  discoveredTrinketIds: [],
  talentXP: {},
  unlockedTalents: {},
  musicVolume: 0,
  sfxVolume: 70,
  activeRun: null,
};

export function loadAlchemySaveData(): SaveData {
  if (typeof window === "undefined") {
    return defaultSaveData;
  }

  const raw = window.localStorage.getItem(storageKey);
  if (!raw) {
    return defaultSaveData;
  }

  try {
    const parsed = JSON.parse(raw) as Partial<SaveData>;
    return {
      selectedResolution: parsed.selectedResolution ?? defaultSaveData.selectedResolution,
      discoveredCardIds: Array.isArray(parsed.discoveredCardIds) ? parsed.discoveredCardIds : defaultSaveData.discoveredCardIds,
      encounteredEnemyIds: Array.isArray(parsed.encounteredEnemyIds) ? parsed.encounteredEnemyIds : defaultSaveData.encounteredEnemyIds,
      discoveredTrinketIds: Array.isArray(parsed.discoveredTrinketIds) ? parsed.discoveredTrinketIds : defaultSaveData.discoveredTrinketIds,
      talentXP: typeof parsed.talentXP === 'object' && parsed.talentXP ? parsed.talentXP as TalentXP : defaultSaveData.talentXP,
      unlockedTalents: typeof parsed.unlockedTalents === 'object' && parsed.unlockedTalents ? parsed.unlockedTalents as UnlockedTalents : defaultSaveData.unlockedTalents,
      musicVolume: typeof parsed.musicVolume === 'number' ? parsed.musicVolume : defaultSaveData.musicVolume,
      sfxVolume: typeof parsed.sfxVolume === 'number' ? parsed.sfxVolume : defaultSaveData.sfxVolume,
      activeRun: parsed.activeRun && typeof parsed.activeRun === 'object' ? parsed.activeRun as ActiveRunData : null,
    };
  } catch {
    return defaultSaveData;
  }
}

export function saveAlchemySaveData(data: SaveData) {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(storageKey, JSON.stringify(data));
}

export function clearAlchemySaveData() {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.removeItem(storageKey);
}
