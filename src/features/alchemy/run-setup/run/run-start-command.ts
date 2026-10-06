import { snapshotTransactionValue } from "@/features/alchemy/shared/stores/run-session-command";
import {
  isEditionCharacterAvailable,
  isEditionModeAvailable,
  isEditionDifficultyAvailable,
  IS_DEMO,
} from "@/lib/game-edition";
import { isCharacterUnlocked } from "@/lib/game-data";
import { computeTalentEffects, type BattleCard, type CharacterId, type DifficultyId } from "@/lib/game-data";
import type { ContentSystemId } from "@/lib/content-systems/types";
import { computeGearManifest, flattenGearInventories } from "@/lib/gear";
import { discoverCardIds } from "@/features/alchemy/shared/stores/profile-store";
import type { RunTransaction } from "@/features/alchemy/shared/stores/run-session-command";
import { applyRunStartSnapshot, grantStartGold } from "@/features/alchemy/shared/stores/run-session-write-port";
import { createRunStartSnapshot, type RunStartSnapshot } from "@/features/alchemy/shared/run-flow/run-start";

interface CreateRunStartSnapshotInput {
  characterId: CharacterId;
  contentSystemType: ContentSystemId;
  difficultyId?: DifficultyId | null | undefined;
  draftedDeck?: BattleCard[] | undefined;
}

interface ApplyRunStartOptions {
  discoverDeck?: boolean;
}

export function createDraftRunStartSnapshot(
  draft: RunTransaction,
  { characterId, contentSystemType, difficultyId, draftedDeck }: CreateRunStartSnapshotInput,
): RunStartSnapshot {
  if (
    !isEditionCharacterAvailable(characterId) ||
    !isEditionModeAvailable(contentSystemType) ||
    (difficultyId != null && !isEditionDifficultyAvailable(difficultyId)) ||
    (IS_DEMO && !isCharacterUnlocked(characterId, draft.profile.finishedRunCharacters))
  ) {
    throw new Error("This run is unavailable");
  }
  const talentXP = draft.runProfile.talentXP;
  const talentStartGold = computeTalentEffects(snapshotTransactionValue(draft.runProfile.unlockedTalents)).startGold;
  const gearMaxHealthBonus = computeGearManifest(
    characterId,
    flattenGearInventories(snapshotTransactionValue(draft.gear.inventories)),
    draft.gear.loadouts,
  ).maxHealth;
  const homesteadMaxHealthBonus = draft.runProfile.effects.runMaxHealthBonus;
  return createRunStartSnapshot({
    characterId,
    contentSystemType,
    difficultyId,
    talentStartGold,
    talentXP,
    draftedDeck,
    gearMaxHealthBonus,
    homesteadMaxHealthBonus,
  });
}

export interface ApplyRunStartResult {
  isFreshStart: boolean;
  startGoldGranted: number;
}

export interface RunReplaceInput {
  isFreshStart: boolean;
  activeCharacterId: CharacterId | null;
  snapshotCharacterId: CharacterId;
  activeContentSystemType: ContentSystemId | null;
  snapshotContentSystemType: ContentSystemId;
  hasActiveBattle: boolean;
  activityKind: string;
}

/**
 * Single owner of the "may a start snapshot replace the current run?" rule.
 * Fresh starts always qualify; otherwise only completing this run's own
 * Wildcard starter draft (at draft confirm or difficulty select, outside
 * battle) may re-apply its snapshot.
 */
export function canReplaceRunForStart(input: RunReplaceInput): boolean {
  if (input.isFreshStart) return true;
  return (
    input.activeCharacterId === "wildcard" &&
    input.snapshotCharacterId === "wildcard" &&
    input.activeContentSystemType === input.snapshotContentSystemType &&
    !input.hasActiveBattle &&
    (input.activityKind === "draft-deck" || input.activityKind === "difficulty-select")
  );
}

/**
 * Narrower companion to canReplaceRunForStart for the difficulty screen: only
 * a Wildcard run already waiting at difficulty select (outside battle) may
 * proceed. Anything else must resume instead of starting over.
 */
export function isDifficultySelectContinuation(input: {
  characterId: CharacterId | null;
  activityKind: string;
  hasActiveBattle: boolean;
}): boolean {
  return input.characterId === "wildcard" && input.activityKind === "difficulty-select" && !input.hasActiveBattle;
}

export function applyRunStartToDraft(
  draft: RunTransaction,
  snapshot: RunStartSnapshot,
  options: ApplyRunStartOptions = {},
): ApplyRunStartResult {
  if (
    !isEditionCharacterAvailable(snapshot.characterId) ||
    !isEditionModeAvailable(snapshot.contentSystemType) ||
    (snapshot.selectedDifficulty != null && !isEditionDifficultyAvailable(snapshot.selectedDifficulty))
  ) {
    throw new Error("This run is unavailable");
  }
  const isFreshStart = draft.session.activity.kind === "inactive";
  if (
    !canReplaceRunForStart({
      isFreshStart,
      activeCharacterId: isFreshStart ? null : draft.run.activeRun.characterId,
      snapshotCharacterId: snapshot.characterId,
      activeContentSystemType: isFreshStart ? null : draft.run.activeRun.contentSystemType,
      snapshotContentSystemType: snapshot.contentSystemType,
      hasActiveBattle: draft.session.activity.kind === "battle",
      activityKind: draft.session.activity.kind,
    })
  ) {
    throw new Error("Cannot replace an unfinished run");
  }
  applyRunStartSnapshot(draft, snapshot);
  const startGoldGranted = isFreshStart ? snapshot.startGoldGrant : 0;
  if (startGoldGranted > 0) {
    grantStartGold(draft, startGoldGranted);
  }
  if (options.discoverDeck || snapshot.characterId === "wildcard") {
    discoverCardIds(
      draft,
      snapshot.freshDeck.map((card) => card.id),
    );
  }
  return { isFreshStart, startGoldGranted };
}
