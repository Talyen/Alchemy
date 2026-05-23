import { create } from "zustand";
import {
  getGoldMultiplier,
  getStartingDeck,
  type BattleCard,
  type CharacterId,
  type DifficultyId,
  talentPool,
  type UnlockedTalents,
  cardLibrary,
  getCardKeywords,
} from "@/lib/game-data";
import { MAX_PLAYER_HEALTH } from "@/lib/game-constants";
import { DESTINATIONS, type Destination } from "@/features/alchemy/types";
import type { ActiveRunData } from "@/features/alchemy/run/types";
import type { ContentSystemId } from "@/lib/content-systems/types";
import { addTalentXP, xpThresholdForPoints, type TalentXP } from "@/lib/talents";
import type { KeywordId } from "@/lib/game-data";

export function hydrateCard(savedCard: BattleCard): BattleCard {
  const libraryCard = cardLibrary.find((c) => c.id === savedCard.id);
  if (!libraryCard) return savedCard;

  const descriptionLines =
    Array.isArray(savedCard.descriptionLines) &&
    (savedCard as unknown as { descriptionLinesFullyValid?: boolean }).descriptionLinesFullyValid !== false
      ? [...savedCard.descriptionLines]
      : [...libraryCard.descriptionLines];

  const effects =
    Array.isArray(savedCard.effects) &&
    (savedCard as unknown as { effectsFullyValid?: boolean }).effectsFullyValid !== false
      ? (savedCard.effects.map((e) => (e && typeof e === "object" ? { ...e } : e)) as BattleCard["effects"])
      : libraryCard.effects.map((e) => ({ ...e }));

  const corruptedValuePositions = Array.isArray(savedCard.corruptedValuePositions)
    ? savedCard.corruptedValuePositions.filter(
        (p) =>
          p &&
          typeof p === "object" &&
          Number.isInteger(p.lineIndex) &&
          Number.isInteger(p.matchIndex) &&
          p.lineIndex >= 0 &&
          p.matchIndex >= 0,
      )
    : undefined;

  const cost =
    typeof savedCard.cost === "number" && Number.isFinite(savedCard.cost) && savedCard.cost >= 0
      ? Math.floor(savedCard.cost)
      : libraryCard.cost;

  const result: BattleCard = {
    ...libraryCard,
    descriptionLines,
    effects,
    cost,
  };
  if (savedCard.consume !== undefined) {
    result.consume = savedCard.consume;
  }
  if (savedCard.corrupted !== undefined) {
    result.corrupted = savedCard.corrupted;
  }
  if (savedCard.baseTitle !== undefined) {
    result.baseTitle = savedCard.baseTitle;
  }
  if (savedCard.uid !== undefined) {
    result.uid = savedCard.uid;
  }
  if (corruptedValuePositions && corruptedValuePositions.length > 0) {
    result.corruptedValuePositions = corruptedValuePositions;
  }
  return result;
}

type RunStateFields = {
  characterId: CharacterId;
  runDeck: BattleCard[];
  runGold: number;
  runPlayerHealth: number;
  runMaxHealth: number;
  roomsEncountered: number;
  currentAct: number;
  destinationIndexInAct: number;
  completedDestinations: Destination[];
  runTrinkets: string[];
  encounteredRunEnemyIds: string[];
  selectedDifficulty: DifficultyId | null;
  contentSystemType: ContentSystemId;
  talentXP: TalentXP;
  runTalentXP: TalentXP;
  unlockedTalents: UnlockedTalents;
};

type Setter<T> = (action: T | ((prev: T) => T)) => void;

type RunStoreActions = {
  setRunDeck: Setter<BattleCard[]>;
  setRunGold: Setter<number>;
  setRunPlayerHealth: Setter<number>;
  setRunMaxHealth: Setter<number>;
  setRoomsEncountered: Setter<number>;
  setCurrentAct: Setter<number>;
  setDestinationIndexInAct: Setter<number>;
  setCompletedDestinations: Setter<Destination[]>;
  setRunTrinkets: Setter<string[]>;
  setEncounteredRunEnemyIds: Setter<string[]>;
  setSelectedDifficulty: Setter<DifficultyId | null>;
  setContentSystemType: Setter<ContentSystemId>;
  setCharacter: (selectedId: CharacterId) => void;
  reset: () => void;
  addRunGold: (amount: number) => void;
  unlockTalent: (keywordId: KeywordId, talentId: string) => void;
  unlockAllTalents: () => void;
  resetUnlockedTalents: () => void;
  resetRunXP: () => void;
  clearPermanentData: () => void;
  awardCardXP: (card: BattleCard) => void;
  awardMysteryXP: (keywordId: KeywordId, amount: number) => void;
  initialize: (
    activeRun: ActiveRunData | null,
    talentXP: TalentXP,
    unlockedTalents: UnlockedTalents,
    fallbackCharacterId?: CharacterId,
  ) => void;
};

type RunStore = RunStateFields & RunStoreActions;

const VALID_DESTINATIONS = new Set<Destination>(Object.values(DESTINATIONS));

function createInitialRunState(
  initialActiveRun: ActiveRunData | null,
  fallbackCharacterId: CharacterId = "knight",
): RunStateFields {
  const characterId = initialActiveRun?.characterId ?? fallbackCharacterId;
  return {
    characterId,
    runDeck: initialActiveRun
      ? initialActiveRun.runDeck.map(hydrateCard)
      : getStartingDeck(characterId).map((c) => ({ ...c })),
    runGold: initialActiveRun?.runGold ?? 0,
    runPlayerHealth: initialActiveRun?.runPlayerHealth ?? MAX_PLAYER_HEALTH,
    runMaxHealth: initialActiveRun?.runMaxHealth ?? MAX_PLAYER_HEALTH,
    roomsEncountered: initialActiveRun?.roomsEncountered ?? 0,
    currentAct: initialActiveRun?.currentAct ?? 1,
    destinationIndexInAct: initialActiveRun?.destinationIndexInAct ?? 0,
    completedDestinations: initialActiveRun?.completedDestinations?.length
      ? initialActiveRun.completedDestinations.filter((d): d is Destination => VALID_DESTINATIONS.has(d as Destination))
      : [],
    runTrinkets: initialActiveRun?.runTrinkets ? [...initialActiveRun.runTrinkets] : [],
    encounteredRunEnemyIds: initialActiveRun?.encounteredRunEnemyIds
      ? [...initialActiveRun.encounteredRunEnemyIds]
      : [],
    selectedDifficulty: initialActiveRun?.selectedDifficulty ?? null,
    contentSystemType: initialActiveRun?.contentSystemType ?? "campaign",
    talentXP: {} as TalentXP,
    runTalentXP: {} as TalentXP,
    unlockedTalents: {} as UnlockedTalents,
  };
}

function createInitialTalentState(
  initialTalentXP: TalentXP,
  initialUnlockedTalents: UnlockedTalents,
): Pick<RunStateFields, "talentXP" | "runTalentXP" | "unlockedTalents"> {
  return { talentXP: initialTalentXP, runTalentXP: {} as TalentXP, unlockedTalents: initialUnlockedTalents };
}

export const useRunStore = create<RunStore>()((set) => ({
  ...createInitialRunState(null),
  ...createInitialTalentState({} as TalentXP, {} as UnlockedTalents),

  setRunDeck: (action) => set((s) => ({ runDeck: typeof action === "function" ? action(s.runDeck) : action })),
  setRunGold: (action) => set((s) => ({ runGold: typeof action === "function" ? action(s.runGold) : action })),
  setRunPlayerHealth: (action) =>
    set((s) => ({ runPlayerHealth: typeof action === "function" ? action(s.runPlayerHealth) : action })),
  setRunMaxHealth: (action) =>
    set((s) => ({ runMaxHealth: typeof action === "function" ? action(s.runMaxHealth) : action })),
  setRoomsEncountered: (action) =>
    set((s) => ({ roomsEncountered: typeof action === "function" ? action(s.roomsEncountered) : action })),
  setCurrentAct: (action) => set((s) => ({ currentAct: typeof action === "function" ? action(s.currentAct) : action })),
  setDestinationIndexInAct: (action) =>
    set((s) => ({ destinationIndexInAct: typeof action === "function" ? action(s.destinationIndexInAct) : action })),
  setCompletedDestinations: (action) =>
    set((s) => ({ completedDestinations: typeof action === "function" ? action(s.completedDestinations) : action })),
  setRunTrinkets: (action) =>
    set((s) => ({ runTrinkets: typeof action === "function" ? action(s.runTrinkets) : action })),
  setEncounteredRunEnemyIds: (action) =>
    set((s) => ({
      encounteredRunEnemyIds: typeof action === "function" ? action(s.encounteredRunEnemyIds) : action,
    })),
  setSelectedDifficulty: (action) =>
    set((s) => ({ selectedDifficulty: typeof action === "function" ? action(s.selectedDifficulty) : action })),
  setContentSystemType: (action) =>
    set((s) => ({ contentSystemType: typeof action === "function" ? action(s.contentSystemType) : action })),

  setCharacter: (selectedId) => set({ characterId: selectedId }),

  reset: () =>
    set((s) => ({
      ...createInitialRunState(null, s.characterId),
      talentXP: s.talentXP,
      unlockedTalents: s.unlockedTalents,
      runTalentXP: {} as TalentXP,
    })),

  addRunGold: (amount) =>
    set((s) => {
      const mult = getGoldMultiplier(s.characterId, s.selectedDifficulty);
      return { runGold: s.runGold + Math.floor(amount * mult) };
    }),

  unlockTalent: (keywordId, talentId) =>
    set((s) => ({
      unlockedTalents: { ...s.unlockedTalents, [keywordId]: [...(s.unlockedTalents[keywordId] ?? []), talentId] },
    })),

  unlockAllTalents: import.meta.env.DEV
    ? () => {
        const next: UnlockedTalents = {};
        const xp: TalentXP = {};
        for (const talent of talentPool) {
          next[talent.keywordId] = [...(next[talent.keywordId] ?? []), talent.id];
        }
        for (const [kw, ids] of Object.entries(next)) {
          xp[kw as KeywordId] = xpThresholdForPoints(ids.length);
        }
        set({ unlockedTalents: next, talentXP: xp, runTalentXP: xp });
      }
    : () => {},

  resetUnlockedTalents: () => set({ unlockedTalents: {} as UnlockedTalents }),
  resetRunXP: () => set({ runTalentXP: {} as TalentXP }),

  clearPermanentData: () =>
    set({
      talentXP: {} as TalentXP,
      runTalentXP: {} as TalentXP,
      unlockedTalents: {} as UnlockedTalents,
    }),

  awardCardXP: (card) => {
    const keywords = getCardKeywords(card);
    if (keywords.length === 0) return;
    set((s) => ({
      talentXP: addTalentXP(s.talentXP, keywords),
      runTalentXP: addTalentXP(s.runTalentXP, keywords),
    }));
  },

  awardMysteryXP: (keywordId, amount) =>
    set((s) => ({
      talentXP: addTalentXP(s.talentXP, [keywordId], amount),
      runTalentXP: addTalentXP(s.runTalentXP, [keywordId], amount),
    })),

  initialize: (activeRun, talentXP, unlockedTalents, fallbackCharacterId = "knight") => {
    const runState = createInitialRunState(activeRun, fallbackCharacterId);
    const talentState = createInitialTalentState(talentXP, unlockedTalents);
    set({ ...runState, ...talentState });
  },
}));
