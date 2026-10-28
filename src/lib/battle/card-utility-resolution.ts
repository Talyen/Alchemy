import {
  isPotionCard,
  companionLibrary,
  type BattleCard,
  type BattleCardEffect,
  type PlayerStatusId,
} from "@/lib/game-data";
import { MIN_MAX_MANA_FLOOR, PERCENT_DENOMINATOR } from "../game-constants";
import { applyPotionMultiplier, halveRounded } from "./amount-helpers";
import { writeCombatFlag } from "./action-context";
import { reduceEnemyArmor } from "./enemy-mitigation-state";
import { emitNoticeText, emitDamageText, emitStatusText } from "./combat-text-events";
import { scaleGoldReward } from "./resource-state";
import { hasCardHealing, type EffectHandlers, type EffectHandler } from "./effect-handlers/handler-types";
import type { BattleState, CombatTextEvent } from "./types";

type PlayerStatusEffect = Extract<BattleCardEffect, { kind: "player-status" }>;
type Feedback = CombatTextEvent["feedback"];

export interface CardUtilityPort {
  healingAmount: (
    state: BattleState,
    card: BattleCard,
    effect: Extract<BattleCardEffect, { kind: "heal" }>,
    potionMult: number,
  ) => number;
  heal: (
    state: BattleState,
    amount: number,
    texts: CombatTextEvent[],
    cardHealing: boolean,
    feedback?: Feedback,
  ) => BattleState;
  mana: (
    state: BattleState,
    amount: number,
    texts: CombatTextEvent[],
    allowOverflow: boolean,
    feedback?: Feedback,
  ) => BattleState;
  manaGainRewards: (state: BattleState, amount: number, texts: CombatTextEvent[]) => BattleState;
  healthCost: (state: BattleState, amount: number, texts: CombatTextEvent[]) => BattleState;
  crystalLoss: (state: BattleState, damage: number, texts: CombatTextEvent[]) => BattleState;
  status: (
    state: BattleState,
    effect: PlayerStatusEffect,
    texts: CombatTextEvent[],
    feedback?: Feedback,
  ) => BattleState;
  chooseStatus: (
    pool: NonNullable<PlayerStatusEffect["statusPool"]>,
    state: BattleState,
  ) => PlayerStatusEffect["status"] | undefined;
  cleanse: (state: BattleState, amount: number, texts: CombatTextEvent[], feedback?: Feedback) => BattleState;
  cleanseStatus: (
    state: BattleState,
    status: PlayerStatusId,
    texts: CombatTextEvent[],
    feedback?: Feedback,
  ) => BattleState;
  gold: (state: BattleState, amount: number, texts: CombatTextEvent[], feedback?: Feedback) => BattleState;
  summon: (state: BattleState, texts: CombatTextEvent[]) => BattleState;
}

const FLAG_EFFECTS = {
  "next-hit-crit": "nextHitCrit",
  "next-hit-leech": "nextHitLeech",
  "play-next-card-twice": "playNextCardTwice",
  "next-hit-poison": "nextHitPoison",
  "next-archery-free": "nextArcheryCardFree",
  "dodge-next-attack": "dodgeNextAttack",
} as const satisfies Record<
  Extract<
    BattleCardEffect["kind"],
    `next-hit-${string}` | "play-next-card-twice" | "next-archery-free" | "dodge-next-attack"
  >,
  keyof BattleState["flags"]
>;

type FlagEffectKind = keyof typeof FLAG_EFFECTS;

const applyFlagEffect = ((state, _card, effect, _potionMult, combatTexts, context) => {
  const flag = FLAG_EFFECTS[effect.kind];
  emitNoticeText(combatTexts, "player", flag, "", {
    signal: "prepared",
    ...(context?.feedback ? { feedback: context.feedback } : {}),
  });
  return writeCombatFlag(state, flag, true);
}) satisfies EffectHandler<FlagEffectKind>;

const FLAG_HANDLERS = {
  "next-hit-crit": applyFlagEffect,
  "next-hit-leech": applyFlagEffect,
  "play-next-card-twice": applyFlagEffect,
  "next-hit-poison": applyFlagEffect,
  "next-archery-free": applyFlagEffect,
  "dodge-next-attack": applyFlagEffect,
} satisfies Pick<EffectHandlers, FlagEffectKind>;

/** Card-specific healing modifiers belong to live resolution, not nominal autoplay utility. */
export function cardHealingAmount(
  state: BattleState,
  card: BattleCard,
  effect: Extract<BattleCardEffect, { kind: "heal" }>,
  potionMult: number,
): number {
  const amount = applyPotionMultiplier(effect.amount, potionMult);
  const potionBonus = effect.amount > 0 && isPotionCard(card) ? (state.talentEffects.homesteadPotionBonus ?? 0) : 0;
  const adjusted = Math.round(amount * (1 + (state.talentEffects.cardHealMultipliers[card.id] ?? 0))) + potionBonus;
  const consumeBonus = card.consume
    ? state.talentEffects.consumeHealMultiplier + state.gearEffects.consumeHealBonusPercent / PERCENT_DENOMINATOR
    : 0;
  return Math.round(adjusted * (1 + consumeBonus));
}

/** Execute utility rules once; live combat and inspection supply reaction policies. */
export function createCardUtilityHandlers(port: CardUtilityPort) {
  const handlers = {
    "restore-mana": (state, _card, effect, potionMult, combatTexts, context) => {
      return port.mana(
        state,
        applyPotionMultiplier(effect.amount, potionMult),
        combatTexts,
        effect.allowOverflow ?? false,
        context?.feedback,
      );
    },
    "lose-mana": (state, _card, effect, _potionMult, combatTexts) => {
      const mana = Math.max(0, state.mana - effect.amount);
      const manaLost = state.mana - mana;
      if (manaLost > 0) emitDamageText(combatTexts, "player", "mana", manaLost, { impact: false });
      return { ...state, mana };
    },
    "gain-max-mana": (state, _card, effect, _potionMult, combatTexts, context) => {
      const amount = effect.amount;
      emitStatusText(combatTexts, "player", "mana", amount, {
        ...(context?.feedback ? { feedback: context.feedback } : {}),
      });
      return port.manaGainRewards(
        { ...state, maxMana: state.maxMana + amount, mana: state.mana + amount },
        amount,
        combatTexts,
      );
    },
    "lose-max-mana": (state, _card, effect, _potionMult, combatTexts) => {
      const maxMana = Math.max(MIN_MAX_MANA_FLOOR, state.maxMana - effect.amount);
      const crystalsLost = state.maxMana - maxMana;
      if (crystalsLost <= 0) return state;
      emitDamageText(combatTexts, "player", "mana", crystalsLost, { impact: false });
      return state.talentEffects.burnDamageOnManaCrystalLoss > 0 && state.enemyHealth > 0
        ? port.crystalLoss(
            { ...state, maxMana, mana: Math.min(maxMana, state.mana) },
            state.talentEffects.burnDamageOnManaCrystalLoss * crystalsLost,
            combatTexts,
          )
        : { ...state, maxMana, mana: Math.min(maxMana, state.mana) };
    },
    heal: (state, card, effect, potionMult, combatTexts, context) => {
      const healAmount = port.healingAmount(state, card, effect, potionMult);
      return port.heal(state, healAmount, combatTexts, hasCardHealing(context), context?.feedback);
    },
    "lose-health": (state, _card, effect, _potionMult, combatTexts) => {
      return port.healthCost(state, effect.amount, combatTexts);
    },
    "player-status": (state, _card, effect, potionMult, combatTexts, context) => {
      let adjustedAmount = effect.amount;
      let nextState = state;
      if (effect.convertCurrentMana !== undefined) {
        adjustedAmount = (context?.manaAtStart ?? state.mana) * effect.convertCurrentMana;
        if (state.mana > 0) {
          emitDamageText(combatTexts, "player", "mana", state.mana, { impact: false });
        }
        nextState = { ...state, mana: 0 };
      } else if (effect.perManaCrystal !== undefined) {
        adjustedAmount = effect.perManaCrystal * state.maxMana;
      }
      const status = effect.statusPool?.length ? port.chooseStatus(effect.statusPool, nextState) : effect.status;
      if (!status) return state;
      if (status !== "haste" && status !== "phoenixFeather") {
        adjustedAmount = applyPotionMultiplier(adjustedAmount, potionMult);
      }
      return port.status(
        nextState,
        {
          ...effect,
          status,
          amount:
            status === "forge" && effect.forgeAmount !== undefined
              ? applyPotionMultiplier(effect.forgeAmount, potionMult)
              : adjustedAmount,
        },
        combatTexts,
        context?.feedback,
      );
    },
    "remove-harmful-status": (state, _card, effect, potionMult, texts, context) => {
      const amount = applyPotionMultiplier(effect.amount ?? 0, potionMult);
      if (!effect.removeAll) state.observer?.descriptionMagnitude?.("amount", amount);
      return port.cleanse(state, effect.removeAll ? Infinity : amount, texts, context?.feedback);
    },
    "remove-player-status": (state, _card, effect, _multiplier, texts, context) =>
      port.cleanseStatus(state, effect.status, texts, context?.feedback),
    "remove-enemy-armor": (state, _card, effect, potionMult, texts, context) => {
      const amount = effect.halve
        ? state.enemyMitigation.armor - halveRounded(state.enemyMitigation.armor)
        : effect.removeAll
          ? state.enemyMitigation.armor
          : applyPotionMultiplier(effect.amount ?? 0, potionMult);
      if (!effect.halve && !effect.removeAll) state.observer?.descriptionMagnitude?.("amount", amount);
      const next = reduceEnemyArmor(state, amount);
      const removed = state.enemyMitigation.armor - next.enemyMitigation.armor;
      if (removed > 0)
        emitDamageText(texts, "enemy", "armor", removed, {
          impact: false,
          ...(context?.feedback ? { feedback: context.feedback } : {}),
        });
      return next;
    },
    "summon-companion": (state, _card, effect, _potionMult, combatTexts, context) => {
      emitNoticeText(combatTexts, "player", "companion", "", {
        ...(context?.feedback ? { feedback: context.feedback } : {}),
      });
      const summoned = { ...state, activeCompanion: companionLibrary[effect.companionId] };
      return port.summon(summoned, combatTexts);
    },
    "gain-gold": (state, _card, effect, potionMult, combatTexts, context) => {
      const adjustedGold = applyPotionMultiplier(effect.amount, potionMult);
      state.observer?.descriptionMagnitude?.("amount", scaleGoldReward(adjustedGold, state.gearEffects));
      if (effect.ifEnemyStunned && state.enemyCC.stunSkipTurns <= 0) {
        return state;
      }
      return port.gold(state, adjustedGold, combatTexts, context?.feedback);
    },
    ...FLAG_HANDLERS,
  } satisfies Partial<EffectHandlers>;
  return handlers;
}
