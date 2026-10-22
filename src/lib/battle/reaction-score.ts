import {
  DAMAGE_TYPES,
  ENEMY_STATUS_DISPLAY_ORDER,
  PLAYER_STATUS_DISPLAY_ORDER,
  getModifiedCompanionEffects,
  harmfulPlayerStatusIds,
  type BattleCard,
  type BattleCardEffect,
} from "@/lib/game-data";
import { halveRounded } from "./amount-helpers";
import { consumeAttackPacketFlags } from "./damage";
import { computeCardAttackPower, computeCardDamageToEnemy } from "./damage-calc";
import { resolveConditionalCardDamage } from "./conditional-card-damage";
import { resolveSecondaryAction } from "./action-context";
import { getBattleCompanionDamageModifiers } from "./companion-scaling";
import { canShatter, consumeReactionOpportunity, getPostHitReactionPayoffs } from "./elemental-reactions";
import { projectEnemyDotDamage } from "./dot-resolve";
import { setEnemyStatus } from "./status-state";
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
  const consumed = consumeAttackPacketFlags(attempted, selected);
  const power = computeCardAttackPower(consumed.state, consumed.packet, card, {
    origin: companion ? "companion" : "played-card",
    baseDamageBonus: companionBonus + (consumed.packet.damageType === "physical" ? consumed.physicalBonus : 0),
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
  const candidate = shatter
    ? {
        ...consumed.state,
        enemyMitigation: { ...consumed.state.enemyMitigation, block: 0, armor: 0 },
        reactions: { ...consumed.state.reactions, shatterDamage: 0 },
      }
    : consumed.state;
  const resolved = computeCardDamageToEnemy(
    candidate,
    consumed.packet,
    card,
    {
      manaAtStart: candidate.mana,
      origin: companion ? "companion" : "played-card",
      baseDamageBonus: companionBonus + (consumed.packet.damageType === "physical" ? consumed.physicalBonus : 0),
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

const FLAG_EFFECT_KEYS: Partial<Record<BattleCardEffect["kind"], keyof BattleState["flags"]>> = {
  "next-hit-crit": "nextHitCrit",
  "next-hit-leech": "nextHitLeech",
  "next-archery-free": "nextArcheryCardFree",
  "next-hit-poison": "nextHitPoison",
  "play-next-card-twice": "playNextCardTwice",
  "dodge-next-attack": "dodgeNextAttack",
};

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

function projectEffects(paths: Projection[], card: BattleCard, effects: readonly BattleCardEffect[]): Projection[] {
  for (const effect of effects) {
    paths = mergeProjections(
      paths.flatMap((path): Projection[] => {
        if (effect.kind === "chance")
          return [
            ...projectEffects(
              [{ ...path, probability: path.probability * effect.probability }],
              card,
              effect.successEffects,
            ),
            ...projectEffects(
              [{ ...path, probability: path.probability * (1 - effect.probability) }],
              card,
              effect.failureEffects,
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
        if (effect.kind === "remove-enemy-armor") {
          const currentArmor = path.state.enemyMitigation.armor;
          if (currentArmor <= 0) return [path];
          const nextArmor = effect.halve
            ? halveRounded(currentArmor)
            : effect.removeAll
              ? 0
              : Math.max(0, currentArmor - (effect.amount ?? 0));
          if (nextArmor === currentArmor) return [path];
          return [
            {
              ...path,
              state: {
                ...path.state,
                enemyMitigation: { ...path.state.enemyMitigation, armor: nextArmor },
              },
            },
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
        if (effect.kind === "remove-player-status") {
          if ((path.state.playerStatuses[effect.status] ?? 0) <= 0) return [path];
          return [
            {
              ...path,
              state: {
                ...path.state,
                playerStatuses: {
                  ...path.state.playerStatuses,
                  [effect.status]: 0,
                },
              },
            },
          ];
        }
        if (effect.kind === "remove-harmful-status") {
          const limit = effect.removeAll ? harmfulPlayerStatusIds.length : (effect.amount ?? 0);
          if (limit <= 0) return [path];
          let removed = 0;
          const nextStatuses = { ...path.state.playerStatuses };
          for (const statusId of harmfulPlayerStatusIds) {
            if (removed >= limit) break;
            if (nextStatuses[statusId] > 0) {
              nextStatuses[statusId] = 0;
              removed++;
            }
          }
          if (removed === 0) return [path];
          return [
            {
              ...path,
              state: {
                ...path.state,
                playerStatuses: nextStatuses,
              },
            },
          ];
        }
        if (effect.kind === "player-status") {
          const pool = effect.statusPool?.length ? effect.statusPool : [effect.status];
          const probability = path.probability / pool.length;
          return pool.map((status) => {
            let amount = effect.amount;
            let nextMana = path.state.mana;
            if (effect.convertCurrentMana !== undefined) {
              amount = path.state.mana * effect.convertCurrentMana;
              nextMana = 0;
            } else if (effect.perManaCrystal !== undefined) {
              amount = effect.perManaCrystal * path.state.maxMana;
            }
            if (status === "forge" && effect.forgeAmount !== undefined) {
              amount = effect.forgeAmount;
            }
            const current = path.state.playerStatuses[status] ?? 0;
            return {
              ...path,
              probability,
              state: {
                ...path.state,
                mana: nextMana,
                playerStatuses: {
                  ...path.state.playerStatuses,
                  [status]: Math.min(Number.MAX_SAFE_INTEGER, current + Math.max(0, amount)),
                },
              },
            };
          });
        }
        if (effect.kind === "restore-mana") {
          const nextMana = effect.allowOverflow
            ? path.state.mana + effect.amount
            : Math.min(path.state.maxMana, path.state.mana + effect.amount);
          if (nextMana === path.state.mana) return [path];
          return [{ ...path, state: { ...path.state, mana: nextMana } }];
        }
        if (effect.kind === "lose-mana") {
          const nextMana = Math.max(0, path.state.mana - effect.amount);
          if (nextMana === path.state.mana) return [path];
          return [{ ...path, state: { ...path.state, mana: nextMana } }];
        }
        const flagKey = FLAG_EFFECT_KEYS[effect.kind];
        if (flagKey) {
          return [
            {
              ...path,
              state: {
                ...path.state,
                flags: {
                  ...path.state.flags,
                  [flagKey]: true,
                },
              },
            },
          ];
        }
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
                  projected = projectEffects([{ ...current, state: scoped }], companionCard, companionCard.effects);
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

export function scoreAvailableReactions(card: BattleCard, snapshot: BattleSnapshot): number {
  const paths = projectEffects(
    [{ state: { ...snapshot, rng: unexpectedScoringRoll }, score: 0, probability: 1 }],
    card,
    card.effects,
  );
  return paths.reduce((sum, path) => sum + path.score * path.probability, 0);
}
