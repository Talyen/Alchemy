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
import { mergeCombatText } from "./combat-text-events";
import {
  hasCardHealing,
  type EffectHandlers,
  type EffectHandler,
  type CardEffectResolutionContext,
} from "./effect-handlers/handler-types";
import type { BattleState, CombatTextEvent } from "./types";

type PlayerStatusEffect = Extract<BattleCardEffect, { kind: "player-status" }>;

export interface CardUtilityPort {
  heal: (state: BattleState, amount: number, texts: CombatTextEvent[], cardHealing: boolean) => BattleState;
  mana: (state: BattleState, amount: number, texts: CombatTextEvent[], allowOverflow: boolean) => BattleState;
  manaHealing: (state: BattleState, amount: number, texts: CombatTextEvent[]) => BattleState;
  healthCost: (state: BattleState, amount: number, texts: CombatTextEvent[]) => BattleState;
  crystalLoss: (state: BattleState, damage: number, texts: CombatTextEvent[]) => BattleState;
  status: (state: BattleState, effect: PlayerStatusEffect, texts: CombatTextEvent[]) => BattleState;
  chooseStatus: (
    pool: NonNullable<PlayerStatusEffect["statusPool"]>,
    state: BattleState,
  ) => PlayerStatusEffect["status"] | undefined;
  cleanse: (state: BattleState, amount: number, texts: CombatTextEvent[]) => BattleState;
  cleanseStatus: (state: BattleState, status: PlayerStatusId, texts: CombatTextEvent[]) => BattleState;
  gold: (state: BattleState, amount: number, texts: CombatTextEvent[]) => BattleState;
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

const applyFlagEffect = ((state, _card, effect, _potionMult, combatTexts) => {
  const flag = FLAG_EFFECTS[effect.kind];
  mergeCombatText(combatTexts, { target: "player", kind: "notice", stat: flag, signal: "prepared", text: "" });
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

/** Execute utility rules once; live combat and inspection supply reaction policies. */
export function createCardUtilityHandlers(port: CardUtilityPort) {
  const handlers = {
    "restore-mana": (state, _card, effect, potionMult, combatTexts) => {
      return port.mana(
        state,
        applyPotionMultiplier(effect.amount, potionMult),
        combatTexts,
        effect.allowOverflow ?? false,
      );
    },
    "lose-mana": (state, _card, effect, _potionMult, combatTexts) => {
      const mana = Math.max(0, state.mana - effect.amount);
      const manaLost = state.mana - mana;
      if (manaLost > 0)
        mergeCombatText(combatTexts, {
          target: "player",
          kind: "damage",
          stat: "mana",
          amount: manaLost,
          impact: false,
        });
      return { ...state, mana };
    },
    "gain-max-mana": (state, _card, effect, _potionMult, combatTexts) => {
      const amount = effect.amount;
      mergeCombatText(combatTexts, { target: "player", kind: "status", stat: "mana", amount });
      return port.manaHealing(
        { ...state, maxMana: state.maxMana + amount, mana: state.mana + amount },
        amount,
        combatTexts,
      );
    },
    "lose-max-mana": (state, _card, effect, _potionMult, combatTexts) => {
      const maxMana = Math.max(MIN_MAX_MANA_FLOOR, state.maxMana - effect.amount);
      const crystalsLost = state.maxMana - maxMana;
      if (crystalsLost <= 0) return state;
      mergeCombatText(combatTexts, {
        target: "player",
        kind: "damage",
        stat: "mana",
        amount: crystalsLost,
        impact: false,
      });
      return state.talentEffects.burnDamageOnManaCrystalLoss > 0 && state.enemyHealth > 0
        ? port.crystalLoss(
            { ...state, maxMana, mana: Math.min(maxMana, state.mana) },
            state.talentEffects.burnDamageOnManaCrystalLoss * crystalsLost,
            combatTexts,
          )
        : { ...state, maxMana, mana: Math.min(maxMana, state.mana) };
    },
    heal: (state, card, effect, potionMult, combatTexts, context) => {
      const potionBonus = isPotionCard(card) && effect.amount > 0 ? (state.talentEffects.homesteadPotionBonus ?? 0) : 0;
      const cardHealMultiplier = 1 + (state.talentEffects.cardHealMultipliers[card.id] ?? 0);
      const adjustedHeal =
        Math.round(applyPotionMultiplier(effect.amount, potionMult) * cardHealMultiplier) + potionBonus;
      const consumeBonus = card.consume
        ? state.talentEffects.consumeHealMultiplier + state.gearEffects.consumeHealBonusPercent / PERCENT_DENOMINATOR
        : 0;
      const healAmount = Math.round(adjustedHeal * (1 + consumeBonus));
      return port.heal(state, healAmount, combatTexts, hasCardHealing(context));
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
          mergeCombatText(combatTexts, {
            target: "player",
            kind: "damage",
            stat: "mana",
            amount: state.mana,
            impact: false,
          });
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
      );
    },
    "remove-harmful-status": (state, _card, effect, potionMult, texts) =>
      port.cleanse(state, effect.removeAll ? Infinity : applyPotionMultiplier(effect.amount ?? 0, potionMult), texts),
    "remove-player-status": (state, _card, effect, _multiplier, texts) =>
      port.cleanseStatus(state, effect.status, texts),
    "remove-enemy-armor": (state, _card, effect, potionMult, texts) => {
      const amount = effect.halve
        ? state.enemyMitigation.armor - halveRounded(state.enemyMitigation.armor)
        : effect.removeAll
          ? state.enemyMitigation.armor
          : applyPotionMultiplier(effect.amount ?? 0, potionMult);
      const next = reduceEnemyArmor(state, amount);
      const removed = state.enemyMitigation.armor - next.enemyMitigation.armor;
      if (removed > 0)
        mergeCombatText(texts, { target: "enemy", kind: "damage", stat: "armor", amount: removed, impact: false });
      return next;
    },
    "summon-companion": (state, _card, effect, _potionMult, combatTexts) => {
      mergeCombatText(combatTexts, { target: "player", kind: "notice", stat: "companion", text: "" });
      const summoned = { ...state, activeCompanion: companionLibrary[effect.companionId] };
      return port.summon(summoned, combatTexts);
    },
    "gain-gold": (state, _card, effect, potionMult, combatTexts) => {
      if (effect.ifEnemyStunned && state.enemyCC.stunSkipTurns <= 0) {
        return state;
      }
      const adjustedGold = applyPotionMultiplier(effect.amount, potionMult);
      return port.gold(state, adjustedGold, combatTexts);
    },
    ...FLAG_HANDLERS,
  } satisfies Partial<EffectHandlers>;
  return handlers;
}

export type CardUtilityHandlers = ReturnType<typeof createCardUtilityHandlers>;
export function applyCardUtilityEffect(
  handlers: CardUtilityHandlers,
  state: BattleState,
  card: BattleCard,
  effect: BattleCardEffect,
  multiplier: number,
  texts: CombatTextEvent[],
  context?: CardEffectResolutionContext,
): BattleState | undefined {
  if (!Object.hasOwn(handlers, effect.kind)) return undefined;
  // The table and key derive from the same effect discriminant.
  const handler = handlers[effect.kind as keyof CardUtilityHandlers] as EffectHandler;
  return handler(state, card, effect, multiplier, texts, context);
}
