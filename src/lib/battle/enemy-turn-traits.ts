import { recordEnemyAbilityActivation } from "./battle-metrics";
import { applyEnemyHealingWithCombatText, mergeCombatText } from "./combat-text";
import type { BestiaryEntry, DifficultyModifier } from "@/lib/game-data";
import { COMBAT_ENCOUNTER_TRAIT_IDS } from "@/lib/content-systems/encounter-traits";
import { logError } from "../error-logger";
import { type BattleState, type CombatTextEvent, addEnemyMitigation, addEnemyStatus, hasEnemyTrait } from "./types";
import {
  DIFFICULTY_FORGE_PER_TURN,
  GLACIAL_SURGE_MAX_FREEZE_BONUS,
  IRON_HIDE_ARMOR_PER_TURN,
  REACTION_ONLY_ENEMY_TRAIT_IDS as REACTION_ONLY_IDS,
  TRAIT_FORGE_PER_TURN,
  TRAIT_FREEZE_BONUS_PER_TURN,
} from "../game-constants";

export function isEveryOtherTurnScalingTurn(state: { turn: number }): boolean {
  return state.turn % 2 === 0;
}

type FreezeAspect = "regen" | "scaling";

export function isFreezeActiveForAspect(state: BattleState, aspect: FreezeAspect): boolean {
  if (state.enemyCC.freezeSkipTurns <= 0) return false;
  if (aspect === "regen") return state.talentEffects.freezeBlocksRegen;
  return state.talentEffects.freezePreventsEnemyScaling;
}

export function scaleByRoomMultiplier(state: BattleState, value: number): number {
  return Math.round(value * state.roomScalingMultiplier);
}

export function processEnemyRegeneration(state: BattleState, combatTexts: CombatTextEvent[]) {
  if (state.enemyRegeneration <= 0) return state;
  if (isFreezeActiveForAspect(state, "regen")) return state;
  let nextState = applyEnemyHealingWithCombatText(state, state.enemyRegeneration, combatTexts);
  if (nextState.enemyHealth > state.enemyHealth && hasEnemyTrait(state, "regeneration"))
    nextState = recordEnemyAbilityActivation(nextState, "regeneration");
  return nextState;
}

const EVERY_OTHER_TURN_TRAITS = new Set(["rusting-carapace", "iron-hide", "glacial-shell"]);

type EnemyTurnStartHandler = (state: BattleState, combatTexts: CombatTextEvent[]) => BattleState;

const enemyTraitTurnStartHandlers: Record<string, EnemyTurnStartHandler> = {
  "rusting-carapace": (state, combatTexts) => {
    mergeCombatText(combatTexts, { target: "enemy", kind: "status", stat: "forge", amount: TRAIT_FORGE_PER_TURN });
    return addEnemyMitigation(state, "forge", TRAIT_FORGE_PER_TURN);
  },
  "iron-hide": (state, combatTexts) => {
    mergeCombatText(combatTexts, {
      target: "enemy",
      kind: "status",
      stat: "armor",
      amount: IRON_HIDE_ARMOR_PER_TURN,
    });
    return addEnemyMitigation(state, "armor", IRON_HIDE_ARMOR_PER_TURN);
  },
  "glacial-shell": (state, combatTexts) => {
    const amount = Math.min(
      TRAIT_FREEZE_BONUS_PER_TURN,
      GLACIAL_SURGE_MAX_FREEZE_BONUS - state.enemyStatuses.freezeBonus,
    );
    if (amount <= 0) return state;
    mergeCombatText(combatTexts, {
      target: "enemy",
      kind: "status",
      stat: "freezeBonus",
      amount,
    });
    return addEnemyStatus(state, "freezeBonus", amount);
  },
  cleric: (state, combatTexts) => {
    mergeCombatText(combatTexts, { target: "enemy", kind: "status", stat: "block", amount: 1 });
    return addEnemyMitigation(state, "block", 1);
  },
  "stone-golem": (state, combatTexts) => {
    mergeCombatText(combatTexts, { target: "enemy", kind: "status", stat: "block", amount: 1 });
    return addEnemyMitigation(state, "block", 1);
  },
};

const difficultyTurnStartHandlers: Partial<Record<DifficultyModifier["kind"], EnemyTurnStartHandler>> = {
  "enemy-gains-forge-each-turn": (state, combatTexts) => {
    mergeCombatText(combatTexts, { target: "enemy", kind: "status", stat: "forge", amount: DIFFICULTY_FORGE_PER_TURN });
    return addEnemyMitigation(state, "forge", DIFFICULTY_FORGE_PER_TURN);
  },
};

const ENEMY_TRAIT_DEFINITIONS: Record<string, { passive: boolean; reaction: boolean; turnStart: boolean }> = (() => {
  const passiveIds: string[] = [
    "brittle-bones",
    "glacial-body",
    "minor-freeze-vulnerability",
    "cold-blooded",
    "minor-holy-vulnerability",
    "tough-hide",
    "vampiric-curse",
    "frozen-apparition",
    "winter-hide",
    "earthen-body",
    "holy-vulnerability",
    "burn-resistance",
    "burn-vulnerability",
    "living-armor",
    "thick-hide",
    "poison-resistance",
    "gold-trove",
    "starting-block",
    "regeneration",
    "freeze-vulnerability",
    "amorphous",
    "cinder-skin",
    ...COMBAT_ENCOUNTER_TRAIT_IDS,
  ];
  const reactionIds: string[] = [...REACTION_ONLY_IDS] as string[];
  const turnStartIds: string[] = Object.keys(enemyTraitTurnStartHandlers);
  const allIds = new Set<string>([...passiveIds, ...reactionIds, ...turnStartIds]);
  const defs: Record<string, { passive: boolean; reaction: boolean; turnStart: boolean }> = {};
  for (const id of allIds) {
    defs[id] = {
      passive: passiveIds.includes(id),
      reaction: reactionIds.includes(id),
      turnStart: turnStartIds.includes(id),
    };
  }
  return defs;
})();

const PASSIVE_ONLY_TRAITS = new Set(
  Object.entries(ENEMY_TRAIT_DEFINITIONS)
    .filter(([, v]) => v.passive)
    .map(([k]) => k),
);

const REACTION_ONLY_TRAITS: ReadonlySet<string> = new Set(
  Object.entries(ENEMY_TRAIT_DEFINITIONS)
    .filter(([, v]) => v.reaction)
    .map(([k]) => k),
);

const PASSIVE_ONLY_MODIFIERS = new Set<DifficultyModifier["kind"]>([
  "enemy-starting-armor",
  "increase-enemy-physical-damage",
  "increase-enemy-damage",
  "increase-enemy-status",
  "enemy-attacks-gain-leech",
  "start-block",
  "start-max-mana",
  "gold-multiplier",
  "start-companion",
  "enemy-health-multiplier",
  "enemy-damage-multiplier",
]);

export const ENEMY_TRAIT_TURN_START_HANDLER_IDS = Object.keys(enemyTraitTurnStartHandlers);

export const PASSIVE_ONLY_ENEMY_TRAIT_IDS = [...PASSIVE_ONLY_TRAITS];

export const REACTION_ONLY_ENEMY_TRAIT_IDS = [...REACTION_ONLY_TRAITS] as string[];

export const DIFFICULTY_TURN_START_MODIFIER_KINDS = Object.keys(difficultyTurnStartHandlers) as Array<
  DifficultyModifier["kind"]
>;

export const PASSIVE_ONLY_DIFFICULTY_MODIFIER_KINDS = [...PASSIVE_ONLY_MODIFIERS];

const ALL_DIFFICULTY_MODIFIER_KINDS: Array<DifficultyModifier["kind"]> = [
  ...DIFFICULTY_TURN_START_MODIFIER_KINDS,
  ...PASSIVE_ONLY_DIFFICULTY_MODIFIER_KINDS,
];

function isEnemyTraitTurnStartCovered(traitId: string): boolean {
  return (
    traitId in enemyTraitTurnStartHandlers || PASSIVE_ONLY_TRAITS.has(traitId) || REACTION_ONLY_TRAITS.has(traitId)
  );
}

function isDifficultyModifierTurnStartCovered(kind: DifficultyModifier["kind"]): boolean {
  return kind in difficultyTurnStartHandlers || PASSIVE_ONLY_MODIFIERS.has(kind);
}

export function collectUncoveredEnemyTraitIds(traitIds: Iterable<string>): string[] {
  return [...new Set(traitIds)].filter((id) => !isEnemyTraitTurnStartCovered(id));
}

export function collectUncoveredDifficultyModifierKinds(
  kinds: Iterable<DifficultyModifier["kind"]> = ALL_DIFFICULTY_MODIFIER_KINDS,
): Array<DifficultyModifier["kind"]> {
  return [...new Set(kinds)].filter((kind) => !isDifficultyModifierTurnStartCovered(kind));
}

function reportHandlerFailure(source: string, err: unknown, context?: Record<string, unknown>): void {
  const message = err instanceof Error ? err.message : String(err);
  logError(`${source} failed: ${message}`, "battle", context);
  if (import.meta.env.DEV) throw err;
}

function processTraitHandler(
  trait: BestiaryEntry["traits"][number],
  state: BattleState,
  combatTexts: CombatTextEvent[],
): BattleState {
  const handler = enemyTraitTurnStartHandlers[trait.id];
  if (handler) {
    if (EVERY_OTHER_TURN_TRAITS.has(trait.id) && !isEveryOtherTurnScalingTurn(state)) return state;
    return handler(recordEnemyAbilityActivation(state, trait.id), combatTexts);
  }
  if (!PASSIVE_ONLY_TRAITS.has(trait.id) && !REACTION_ONLY_TRAITS.has(trait.id)) {
    console.warn(`[Battle] No turn-start handler for trait: ${trait.id}`);
    reportHandlerFailure(`No turn-start handler for trait ${trait.id}`, new Error("uncovered enemy trait"), {
      traitId: trait.id,
    });
  }
  return state;
}

function processDifficultyModifier(
  modifier: DifficultyModifier,
  state: BattleState,
  combatTexts: CombatTextEvent[],
  scalingBlocked: boolean,
): BattleState {
  const handler = difficultyTurnStartHandlers[modifier.kind];
  if (!handler) {
    if (!PASSIVE_ONLY_MODIFIERS.has(modifier.kind)) {
      console.warn(`[Battle] No turn-start handler for difficulty modifier: ${modifier.kind}`);
      reportHandlerFailure(
        `No turn-start handler for difficulty modifier ${modifier.kind}`,
        new Error("uncovered difficulty modifier"),
      );
    }
    return state;
  }
  if (modifier.kind === "enemy-gains-forge-each-turn" && scalingBlocked) return state;
  return handler(state, combatTexts);
}

export function processEnemyTraits(state: BattleState, combatTexts: CombatTextEvent[]) {
  let nextState = state;
  const scalingBlocked = isFreezeActiveForAspect(nextState, "scaling");

  if (!scalingBlocked) {
    for (const trait of nextState.currentEnemy.traits) {
      try {
        nextState = processTraitHandler(trait, nextState, combatTexts);
      } catch (err) {
        if (import.meta.env.DEV) throw err;
        reportHandlerFailure(`Enemy trait handler for ${trait.id}`, err);
      }
    }
  }

  for (const modifier of nextState.difficultyModifiers) {
    try {
      nextState = processDifficultyModifier(modifier, nextState, combatTexts, scalingBlocked);
    } catch (err) {
      if (import.meta.env.DEV) throw err;
      reportHandlerFailure(`Difficulty modifier handler for ${modifier.kind}`, err, { kind: modifier.kind });
    }
  }

  return nextState;
}
