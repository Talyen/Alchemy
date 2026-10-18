import {
  DAMAGE_TYPES,
  ENEMY_STATUS_DISPLAY_ORDER,
  getModifiedCompanionEffects,
  type BattleCard,
  type BattleCardEffect,
} from "@/lib/game-data";
import { consumeAttackPacketFlags } from "./damage";
import { computeCardAttackPower, computeCardDamageToEnemy } from "./damage-calc";
import { resolveConditionalCardDamage } from "./conditional-card-damage";
import { resolveSecondaryAction } from "./action-context";
import { getBattleCompanionDamageModifiers } from "./companion-scaling";
import { canShatter, consumeReactionOpportunity, getPostHitReactionPayoffs } from "./elemental-reactions";
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
  if ((stat === "burn" || stat === "poison") && healthDamage > 0) {
    state = {
      ...state,
      enemyStatuses: {
        ...state.enemyStatuses,
        [stat]: Math.min(Number.MAX_SAFE_INTEGER, state.enemyStatuses[stat] + resolved.modifiedDamage),
      },
    };
  }
  if (selected.detonateAllBurn) state = setEnemyStatus(state, "burn", 0);
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
  const statuses = ENEMY_STATUS_DISPLAY_ORDER.map((key) => state.enemyStatuses[key]).join(",");
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
  return `${state.enemyHealth}|${state.enemyMitigation.armor},${state.enemyMitigation.forge},${state.enemyMitigation.block}|${statuses}|${reactions}|${flags}|${action}`;
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
          return pool.map((damageType) =>
            projectHit(
              { ...path, probability: path.probability / pool.length },
              card,
              effect.kind === "damage"
                ? { ...effect, damageType }
                : {
                    kind: "damage",
                    damageType,
                    amount: (effect.minAmount + effect.maxAmount) / 2,
                  },
            ),
          );
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
