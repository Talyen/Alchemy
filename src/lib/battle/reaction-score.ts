import {
  DAMAGE_TYPES,
  ENEMY_STATUS_DISPLAY_ORDER,
  PLAYER_STATUS_DISPLAY_ORDER,
  getModifiedCompanionEffects,
  harmfulPlayerStatusIds,
  type BattleCard,
  type BattleCardEffect,
} from "@/lib/game-data";
import { gainMana } from "./resource-state";
import { createPlayerResourceResolver } from "./player-resource-resolution";
import { createCardUtilityHandlers } from "./card-utility-resolution";
import type { EffectHandler } from "./effect-handlers/handler-types";
import { prepareAttackPacket } from "./damage";
import { computeCardAttackPower, computeCardDamageToEnemy } from "./damage-calc";
import { resolveConditionalCardDamage } from "./conditional-card-damage";
import { resolveSecondaryAction } from "./action-context";
import { getBattleCompanionDamageModifiers } from "./companion-scaling";
import { applyShatter, canShatter, consumeReactionOpportunity, getPostHitReactionPayoffs } from "./elemental-reactions";
import { projectEnemyDotDamage } from "./dot-resolve";
import { addPlayerStatus, setEnemyStatus } from "./status-state";
import { dealSelfDamage } from "./status-helpers";
import { FLAG_DEFINITIONS } from "./combat-flags";
import type { BattleSnapshot, BattleState } from "./types";

type DamageEffect = Extract<BattleCardEffect, { kind: "damage" }>;
interface Projection {
  state: BattleState;
  score: number;
  probability: number;
}
function unexpectedScoringRoll(): never {
  throw new Error("Reaction scoring must not roll randomness");
}

function projectHit(path: Projection, card: BattleCard, effect: DamageEffect): Projection {
  const before = path.state;
  if (before.enemyHealth <= 0 || before.playerHealth <= 0) return path;
  const selected = resolveConditionalCardDamage(effect, before.enemyCC.freezeSkipTurns > 0);
  const companion = before.action?.source === "companion";
  const companionBonus = companion ? before.flags.companionNextAttackBonus : 0;
  const attempted =
    companionBonus > 0 ? { ...before, flags: { ...before.flags, companionNextAttackBonus: 0 } } : before;
  const consumed = prepareAttackPacket(attempted, selected, companionBonus);
  const { baseDamageBonus } = consumed;
  const power = computeCardAttackPower(consumed.state, consumed.packet, card, {
    origin: companion ? "companion" : "played-card",
    baseDamageBonus,
  });
  if (
    power.damage <= 0 &&
    !(
      consumed.packet.damageType === "stun" &&
      before.gearEffects.armorIncreasesStun > 0 &&
      before.enemyMitigation.armor > 0
    )
  )
    return { ...path, state: attempted };
  const shatter = consumed.packet.damageType === "physical" && canShatter(before);
  const candidate = shatter ? applyShatter(consumed.state, []) : consumed.state;
  const resolved = computeCardDamageToEnemy(
    candidate,
    consumed.packet,
    card,
    {
      manaAtStart: candidate.mana,
      origin: companion ? "companion" : "played-card",
      baseDamageBonus,
    },
    "prepared-only",
  );
  const healthDamage = Math.min(candidate.enemyHealth, resolved.modifiedDamage);
  let state = { ...resolved.nextState, enemyHealth: candidate.enemyHealth - healthDamage };
  // Project certain direct status additions, never chance riders or CC procs.
  const stat = consumed.packet.damageType;
  if ((stat === "burn" || stat === "poison" || stat === "bleed") && healthDamage > 0) {
    state = {
      ...state,
      enemyStatuses: {
        ...state.enemyStatuses,
        [stat]: Math.min(Number.MAX_SAFE_INTEGER, state.enemyStatuses[stat] + resolved.modifiedDamage),
      },
    };
  }
  if (selected.detonateAllBurn) {
    const detonated = projectEnemyDotDamage(state, "burn");
    state = { ...setEnemyStatus(state, "burn", 0), enemyHealth: Math.max(0, state.enemyHealth - detonated) };
  }
  if (selected.detonateAllBleed) {
    const detonated = projectEnemyDotDamage(state, "bleed");
    state = { ...setEnemyStatus(state, "bleed", 0), enemyHealth: Math.max(0, state.enemyHealth - detonated) };
  }
  const payoffs = getPostHitReactionPayoffs(before, state, consumed.packet.damageType, healthDamage);
  let score = shatter ? before.enemyMitigation.block + before.enemyMitigation.armor : 0;
  if (shatter) payoffs.unshift({ id: "shatter", damage: before.reactions.shatterDamage });
  for (const payoff of payoffs) {
    if (state.enemyHealth <= 0) break;
    score += Math.min(state.enemyHealth, payoff.damage);
    state = {
      ...consumeReactionOpportunity(state, payoff.id),
      enemyHealth: Math.max(0, state.enemyHealth - payoff.damage),
    };
  }
  return { ...path, state, score: path.score + score };
}

/** Random-type cards can have many equivalent paths; merge them before the next effect. */
const FLAG_KEY_ORDER = Object.keys(FLAG_DEFINITIONS);

function projectionKey(state: BattleState): string {
  const enemyStatuses = ENEMY_STATUS_DISPLAY_ORDER.map((key) => state.enemyStatuses[key]).join(",");
  const playerStatuses = PLAYER_STATUS_DISPLAY_ORDER.map((key) => state.playerStatuses[key]).join(",");
  const flags = FLAG_KEY_ORDER.map((key) => {
    const value = state.flags[key as keyof typeof state.flags];
    return typeof value === "boolean" ? (value ? "1" : "0") : String(value);
  }).join(",");
  const reactions = [
    state.reactions.shatterDamage,
    state.reactions.frostfireDamage,
    state.reactions.thunderclapDamage,
    state.reactions.wildfirePendingTickDamage ?? "x",
    state.reactions.wildfireLastTickTurn ?? "x",
    state.reactions.wildfireDamage,
    state.reactions.consecrated ? "1" : "0",
  ].join(",");
  const action = state.action ? `${state.action.source},${state.action.repeatActive ? "1" : "0"}` : "-";
  const cc = `${state.enemyCC.freezeSkipTurns},${state.enemyCC.stunSkipTurns}`;
  return `${state.playerHealth}|${state.mana},${state.maxMana}|${state.enemyHealth}|${state.enemyMitigation.armor},${state.enemyMitigation.forge},${state.enemyMitigation.block}|${enemyStatuses}|${playerStatuses}|${reactions}|${flags}|${cc}|${action}`;
}

function mergeProjections(paths: Projection[]): Projection[] {
  if (paths.length < 2) return paths;
  const merged = new Map<string, Projection>();
  for (const path of paths) {
    const key = projectionKey(path.state);
    const prior = merged.get(key);
    if (!prior) merged.set(key, path);
    else {
      const probability = prior.probability + path.probability;
      merged.set(key, {
        ...prior,
        probability,
        score: (prior.score * prior.probability + path.score * path.probability) / probability,
      });
    }
  }
  return [...merged.values()];
}

const playerResources = createPlayerResourceResolver({
  chance: (chance) => chance >= 100,
  afterHealing: (state) => state,
  drawHoly: (state) => state,
  forgeReady: () => {},
});

// These are deliberate score approximations. The production utility owner still
// owns effect ordering, conversions, resource floors, and prepared flags.
const utilityHandlers = createCardUtilityHandlers({
  healingAmount: (_state, _card, effect) => effect.amount,
  heal: (state, amount) => ({ ...state, playerHealth: Math.min(state.playerMaxHealth, state.playerHealth + amount) }),
  mana: (state, amount, _texts, overflow) => gainMana(state, amount, overflow),
  manaGainRewards: (state) => state,
  healthCost: (state, amount) => {
    const damaged = dealSelfDamage(state, amount, "health", []).state;
    return playerResources.checkHealthThresholds(state.playerHealth, damaged.playerHealth, damaged, []);
  },
  crystalLoss: (state) => state,
  status: playerResources.applyPlayerStatusEffect,
  chooseStatus: () => {
    throw new Error("Scoring must branch before utility resolution");
  },
  cleanse: (state, amount) => {
    const statuses = { ...state.playerStatuses };
    let removed = 0;
    for (const status of harmfulPlayerStatusIds) {
      if (removed >= amount) break;
      if (statuses[status] > 0) {
        statuses[status] = 0;
        removed++;
      }
    }
    return { ...state, playerStatuses: statuses };
  },
  cleanseStatus: (state, status) => ({ ...state, playerStatuses: { ...state.playerStatuses, [status]: 0 } }),
  // Gold and summons are valued nominally by autoplay-policy, not reaction scoring.
  gold: (state) => state,
  summon: (state) => state,
});

function projectEffects(
  paths: Projection[],
  card: BattleCard,
  effects: readonly BattleCardEffect[],
  manaAtStart: number,
): Projection[] {
  for (const effect of effects) {
    paths = mergeProjections(
      paths.flatMap((path): Projection[] => {
        if (path.state.playerHealth <= 0) return [path];
        if (effect.kind === "chance")
          return [
            ...projectEffects(
              [{ ...path, probability: path.probability * effect.probability }],
              card,
              effect.successEffects,
              manaAtStart,
            ),
            ...projectEffects(
              [{ ...path, probability: path.probability * (1 - effect.probability) }],
              card,
              effect.failureEffects,
              manaAtStart,
            ),
          ].filter((branch) => branch.probability > 0);
        if (effect.kind === "damage" || effect.kind === "random-damage") {
          const pool = effect.damageTypePool?.length
            ? effect.damageTypePool
            : effect.kind === "damage"
              ? [effect.damageType]
              : DAMAGE_TYPES;
          if (effect.kind === "damage") {
            return pool.map((damageType) =>
              projectHit({ ...path, probability: path.probability / pool.length }, card, { ...effect, damageType }),
            );
          }
          // Damage rounding, mitigation, and lethal cutoffs are nonlinear. Keep
          // the integer outcomes until after their payoffs have been resolved.
          // Validated card magnitudes bound the range to 1..999.
          const outcomes: Projection[] = [];
          const probability = path.probability / (pool.length * (effect.maxAmount - effect.minAmount + 1));
          for (let amount = effect.minAmount; amount <= effect.maxAmount; amount++) {
            for (const damageType of pool) {
              outcomes.push(
                projectHit({ ...path, probability }, card, {
                  kind: "damage",
                  damageType,
                  amount,
                  ...(effect.lifesteal ? { lifesteal: true } : {}),
                }),
              );
            }
          }
          return outcomes;
        }
        if (effect.kind === "cleanse-player-status-to-damage") {
          const stacks = path.state.playerStatuses[effect.status] ?? 0;
          if (stacks <= 0) return [path];
          const cleansedState = {
            ...path.state,
            playerStatuses: {
              ...path.state.playerStatuses,
              [effect.status]: 0,
            },
          };
          return [
            projectHit({ ...path, state: cleansedState }, card, {
              kind: "damage",
              damageType: effect.damageType,
              amount: stacks,
              ...(effect.lifesteal ? { lifesteal: true } : {}),
            }),
          ];
        }
        if (effect.kind === "multiply-enemy-status") {
          const current = path.state.enemyStatuses[effect.status] ?? 0;
          if (current <= 0 || effect.factor === 1) return [path];
          const added = Math.round(current * (effect.factor - 1));
          if (added === 0) return [path];
          return [
            {
              ...path,
              state: {
                ...path.state,
                enemyStatuses: {
                  ...path.state.enemyStatuses,
                  [effect.status]: Math.min(Number.MAX_SAFE_INTEGER, current + added),
                },
              },
            },
          ];
        }
        if (effect.kind === "player-status") {
          const pool = effect.statusPool?.length ? effect.statusPool : [effect.status];
          const probability = path.probability / pool.length;
          return pool.map((status) => {
            // A resolved pool branch must not be sampled again by the utility owner.
            const { statusPool: _pool, ...selected } = effect;
            return {
              ...path,
              probability,
              state: utilityHandlers["player-status"](path.state, card, { ...selected, status }, 1, [], {
                manaAtStart,
              }),
            };
          });
        }
        if (effect.kind === "self-damage") {
          if (path.state.enemyHealth <= 0 || path.state.playerHealth <= 0) return [path];
          const { state: nextState, healthLost } = dealSelfDamage(path.state, effect.amount, effect.damageType, []);
          const statusType = harmfulPlayerStatusIds.find((id) => id === effect.damageType);
          const withStatus =
            statusType && healthLost > 0 ? addPlayerStatus(nextState, statusType, healthLost) : nextState;
          return [{ ...path, state: withStatus }];
        }
        if (
          effect.kind !== "heal" &&
          effect.kind !== "gain-gold" &&
          effect.kind !== "summon-companion" &&
          Object.hasOwn(utilityHandlers, effect.kind)
        ) {
          const apply = utilityHandlers[effect.kind as keyof typeof utilityHandlers] as EffectHandler;
          return [{ ...path, state: apply(path.state, card, effect, 1, [], { manaAtStart }) }];
        }
        // Nominal healing intentionally excludes card-specific/potion bonuses.
        if (effect.kind === "heal")
          return [{ ...path, state: utilityHandlers.heal(path.state, card, effect, 1, [], { manaAtStart }) }];
        if (effect.kind === "companion-action" && path.state.activeCompanion) {
          const companion = path.state.activeCompanion;
          const companionCard: BattleCard = {
            id: `companion-${companion.id}`,
            title: companion.title,
            art: companion.art,
            cost: 0,
            descriptionLines: [],
            effects: getModifiedCompanionEffects(
              companion,
              path.state.talentEffects.companionBondLevels?.[companion.id] ?? 0,
              getBattleCompanionDamageModifiers(path.state),
            ),
          };
          let next = [path];
          for (let i = 0; i < effect.amount; i++) {
            next = mergeProjections(
              next.flatMap((current) => {
                let projected: Projection[] = [];
                resolveSecondaryAction(current.state, "companion", (scoped) => {
                  projected = projectEffects(
                    [{ ...current, state: scoped }],
                    companionCard,
                    companionCard.effects,
                    scoped.mana,
                  );
                  return scoped;
                });
                return projected.map((result) => {
                  const { action: _action, ...unscoped } = result.state;
                  return {
                    ...result,
                    state: current.state.action ? { ...unscoped, action: current.state.action } : unscoped,
                  };
                });
              }),
            );
          }
          return next;
        }
        return [path];
      }),
    );
  }
  return paths;
}

export function scoreAvailableReactions(card: BattleCard, snapshot: BattleSnapshot, manaAtStart?: number): number {
  const playTwice = snapshot.flags.playNextCardTwice;
  const initial = playTwice ? { ...snapshot, flags: { ...snapshot.flags, playNextCardTwice: false } } : snapshot;
  let paths = projectEffects(
    [{ state: { ...initial, rng: unexpectedScoringRoll }, score: 0, probability: 1 }],
    card,
    card.effects,
    manaAtStart ?? snapshot.mana,
  );
  if (playTwice) {
    paths = projectEffects(paths, { ...card, consume: false }, card.effects, manaAtStart ?? snapshot.mana);
  }
  return paths.reduce((sum, path) => sum + path.score * path.probability, 0);
}
