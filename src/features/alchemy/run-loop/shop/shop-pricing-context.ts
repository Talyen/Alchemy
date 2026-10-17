import { type GameSession } from "@/features/alchemy/shared/stores/game-session-types";
import { readEquippedTrinketId } from "@/features/alchemy/shared/stores/gear-store";
import { readActiveRun, readRunProfile, readRunSession } from "@/features/alchemy/shared/stores/run-reads";
import { snapshotTransactionValue, type RunTransaction } from "@/features/alchemy/shared/stores/run-session-command";
import { readActivityData } from "@/lib/active-run-session";
import type { EncounterRewardTraitId } from "@/lib/content-systems/encounter-traits";
import { activeLabyrinthBenefits } from "@/lib/content-systems/labyrinth/room-rules";
import { computeTalentEffects } from "@/lib/game-data";
import { combineTrinketEffectIds } from "@/lib/trinkets";
import type { ShopBuyPriceContext } from "./shop-pricing";
import type { ShopActivity } from "./shop-action-types";

export function resolveReadShopEffects(gameSession: GameSession) {
  const profile = readRunProfile(gameSession);
  return { talentEffects: computeTalentEffects(profile.unlockedTalents), homesteadEffects: profile.effects };
}

export function resolveDraftShopEffects(draft: RunTransaction) {
  return {
    talentEffects: computeTalentEffects(snapshotTransactionValue(draft.runProfile.unlockedTalents)),
    homesteadEffects: draft.runProfile.effects,
  };
}

export function resolveReadShopModifiers(gameSession: GameSession): readonly EncounterRewardTraitId[] {
  const run = readActiveRun(gameSession);
  return (
    activeLabyrinthBenefits(run.contentSystemType, readRunSession(gameSession).activeLabyrinthRewardModifiers) ?? []
  );
}

export function resolveDraftShopModifiers(draft: RunTransaction): readonly EncounterRewardTraitId[] {
  return (
    activeLabyrinthBenefits(draft.run.activeRun.contentSystemType, draft.session.activeLabyrinthRewardModifiers) ?? []
  );
}

export function resolveReadShopPricingContext(activity: ShopActivity, gameSession: GameSession): ShopBuyPriceContext {
  const run = readActiveRun(gameSession);
  return {
    talentEffects: resolveReadShopEffects(gameSession).talentEffects,
    modifiers: activeLabyrinthBenefits(
      run.contentSystemType,
      readRunSession(gameSession).activeLabyrinthRewardModifiers,
    ),
    runBoons: combineTrinketEffectIds(run.runBoons, readEquippedTrinketId(run.characterId, gameSession)),
    firstPurchaseUsed: readActivityData(readRunSession(gameSession).activity, activity).firstPurchaseUsed,
  };
}

export function resolveDraftShopPricingContext(
  draft: RunTransaction,
  state: { firstPurchaseUsed: boolean },
): ShopBuyPriceContext {
  return {
    talentEffects: resolveDraftShopEffects(draft).talentEffects,
    modifiers: resolveDraftShopModifiers(draft),
    runBoons: combineTrinketEffectIds(
      draft.run.activeRun.runBoons,
      draft.gear.equippedTrinkets[draft.run.activeRun.characterId],
    ),
    firstPurchaseUsed: state.firstPurchaseUsed,
  };
}
