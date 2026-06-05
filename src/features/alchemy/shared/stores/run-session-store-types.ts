// Transient per-run session UI state (shops, labyrinth, mystery, rewards).
import type { BattleCard, CharacterId } from "@/lib/game-data";
import type { ContentSystemId, LabyrinthMap, LabyrinthModifierKind } from "@/lib/content-systems/types";
import type { CorruptionResult } from "@/lib/corruption";
import type { MysteryEvent } from "@/lib/mystery";
import type { MaterialInventory } from "@/lib/homestead/types";
import type { LabyrinthNodePosition } from "@/lib/active-run-session";
import type { RewardState } from "@/features/alchemy/navigation/reward-flow";
import type { ShopState, AlchemistState } from "@/features/alchemy/shop/shop-state-init";
import type { TalentXP } from "@/lib/talents";
import type { Setter } from "@/lib/utils";

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

export type RunSessionStore = RunSessionFields & RunSessionActions;
