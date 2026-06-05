// Merged active-run store: persisted run fields, transient session UI, and navigation screen.
import type { BattleCard, CharacterId, DifficultyId, KeywordId, UnlockedTalents } from "@/lib/game-data";
import type { ActiveRunData } from "@/features/alchemy/run/types";
import type { RunStartSnapshot } from "@/features/alchemy/run/run-start";
import type { Destination, Screen } from "@/features/alchemy/types";
import type { ContentSystemId, LabyrinthMap, LabyrinthModifierKind } from "@/lib/content-systems/types";
import type { TalentXP } from "@/lib/talents";
import type { Setter } from "@/lib/utils";
import type { RunStateFields } from "@/features/alchemy/run/run-state-init";
import type { RewardState } from "@/features/alchemy/navigation/reward-flow";
import type { CorruptionResult } from "@/lib/corruption";
import type { MysteryEvent } from "@/lib/mystery";
import type { MaterialInventory } from "@/lib/homestead/types";
import type { LabyrinthNodePosition } from "@/features/alchemy/run/types";
import type { ShopState, AlchemistState } from "@/features/alchemy/shop/shop-state-init";

export type RunSessionFields = {
  hasActiveRun: boolean;
  activeLabyrinthModifiers: LabyrinthModifierKind[];
  activeLabyrinthRewardModifiers: LabyrinthModifierKind[];
  activeLabyrinthPendingNode: LabyrinthNodePosition | null;
  rewardState: RewardState;
  companionRewardCards: BattleCard[] | null;
  runEndMaterials: MaterialInventory;
  runEndTalentXP: TalentXP;
  corruptionResult: CorruptionResult | null;
  pendingCharacterId: CharacterId | null;
  pendingContentSystemType: ContentSystemId;
  labyrinthMap: LabyrinthMap;
  shopState: ShopState;
  alchemistState: AlchemistState;
  mysteryEvent: MysteryEvent | null;
  mysteryCardChoices: BattleCard[] | null;
};

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
  finalizeRunXP: () => void;
  initialize: (
    activeRun: ActiveRunData | null,
    talentXP: TalentXP,
    unlockedTalents: UnlockedTalents,
    fallbackCharacterId?: CharacterId,
  ) => void;
  hydrateFromSnapshot: (snapshot: RunStartSnapshot) => void;
};

type RunSessionActions = {
  setHasActiveRun: (active: boolean) => void;
  setActiveLabyrinthModifiers: (modifiers: LabyrinthModifierKind[]) => void;
  setActiveLabyrinthRewardModifiers: (modifiers: LabyrinthModifierKind[]) => void;
  setActiveLabyrinthPendingNode: (node: LabyrinthNodePosition | null) => void;
  setRewardState: Setter<RewardState>;
  setCompanionRewardCards: (cards: BattleCard[] | null) => void;
  setRunEndMaterials: (materials: MaterialInventory) => void;
  setRunEndTalentXP: (xp: TalentXP) => void;
  setCorruptionResult: (result: CorruptionResult | null) => void;
  setPendingCharacterId: (id: CharacterId | null) => void;
  setPendingContentSystemType: (type: ContentSystemId) => void;
  setLabyrinthMap: Setter<LabyrinthMap>;
  setShopState: Setter<ShopState>;
  setAlchemistState: Setter<AlchemistState>;
  setMysteryEvent: (event: MysteryEvent | null) => void;
  setMysteryCardChoices: (choices: BattleCard[] | null | ((prev: BattleCard[] | null) => BattleCard[] | null)) => void;
  clearTransientSession: () => void;
};

type NavigationActions = {
  setScreen: Setter<Screen>;
};

export type ActiveRunStore = RunStateFields &
  RunSessionFields & { screen: Screen } & RunStoreActions &
  RunSessionActions &
  NavigationActions;

/** @deprecated Use ActiveRunStore — kept for selectors and legacy imports. */
export type RunStore = ActiveRunStore;
