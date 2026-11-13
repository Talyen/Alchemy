import { mergeCombatText } from "./combat-text-events";
import { rollBattleChance } from "./chance-roll";
import { resolvePendingBattleReactions } from "./enemy-attack-damage";
import type { CardEffectResolutionContext } from "./effect-handlers/handler-types";
import type { BattleState, CombatTextEvent, CompanionActionCue } from "./types";
import { applyScaledLeechHealing, computeLeechHeal } from "./stun-leech-resolution";
import { processEncounterTraitCardAction } from "./encounter-trait-events";
import { applyHealingWithCombatText, gainManaWithCombatText } from "./player-rewards";
import { resolveFollowUpHit } from "./follow-up-hit-resolution";
import { addForgeToPlayer } from "./player-rewards";
import { resolveSecondaryAction } from "./action-context";
import { HALF_DIVISOR } from "../game-constants";
import { damageOnlyEffects, isAttackCard } from "./card-classification";
import type { BattleCard } from "@/lib/game-data";
import { getBattleOutcome, isPlayerDefeated } from "./battle-outcome";
import { createCompanionActionCard } from "./companion-scaling";

// The effect interpreter stays injected to avoid importing the registry that calls this owner.
export function resolveCompanionTurnStart(
  state: BattleState,
  combatTexts: CombatTextEvent[],
  applyEffects: (
    state: BattleState,
    card: BattleCard,
    combatTexts: CombatTextEvent[],
    context?: CardEffectResolutionContext,
  ) => BattleState,
  options?: { damageOnly?: boolean },
) {
  const companion = state.activeCompanion;
  if (!companion || getBattleOutcome(state) !== null) return state;

  const companionCard = createCompanionActionCard(state, companion);

  if (options?.damageOnly) companionCard.effects = damageOnlyEffects(companionCard.effects);

  const sequence = state.companionActionSequence ?? { current: 0 };
  state = { ...state, companionActionSequence: sequence };
  const health = (s: BattleState) => ({ playerHealth: s.playerHealth, enemyHealth: s.enemyHealth });
  const groups: Array<NonNullable<CompanionActionCue["resolution"]>> = [
    { id: ++sequence.current, before: health(state), after: health(state), texts: [] },
  ];
  let currentGroup = groups[0]!;
  const texts: CombatTextEvent[] = [];
  const cue = { companionId: companion.id, kind: isAttackCard(companionCard) ? "attack" : "cast" } as const;
  // Owl/Moth Bond repeats are resolved inside this action's chance effect.
  // Observe the actual roll; presentation must neither reroll it nor infer success.
  const repeat =
    cue.companionId === "library-owl" || cue.companionId === "mana-moth" ? companionCard.effects[1] : undefined;

  const resolved = resolveSecondaryAction(state, "companion", (s) => {
    const burningEnemy = s.enemyStatuses.burn > 0;
    const companionAttackBonus = { amount: s.flags.companionNextAttackBonus };
    const damageEffects: NonNullable<CardEffectResolutionContext["damageEffects"]> = [];
    const attackAttempted = { value: false };
    let damageDealt = 0;
    let damagePackets = 0;
    let afterEffects = processEncounterTraitCardAction(
      applyEffects(s, companionCard, texts, {
        manaAtStart: s.mana,
        companionAttackBonus,
        origin: "companion",
        damageEffects,
        attackAttempted,
        onDamageDealt: (amount) => {
          damageDealt += amount;
          if (amount > 0) damagePackets += 1;
        },
        onChanceResolved: (effect, success) => {
          if (success && effect === repeat) {
            currentGroup = { id: ++sequence.current, before: currentGroup.after, after: currentGroup.after, texts: [] };
            groups.push(currentGroup);
          }
        },
        onEffectResolved: (_effect, before, after, events) => {
          if (currentGroup !== groups[0] && currentGroup.texts.length === 0) currentGroup.before = health(before);
          for (const event of events) event.companionActionId ??= currentGroup.id;
          currentGroup.after = health(after);
        },
      }),
      companionCard,
      texts,
      damageEffects.length > 0 || attackAttempted.value,
      { cardPlayed: false },
    );

    afterEffects = {
      ...afterEffects,
      flags: { ...afterEffects.flags, companionNextAttackBonus: companionAttackBonus.amount },
    };
    if (isPlayerDefeated(afterEffects)) return afterEffects;
    if (damageDealt > 0 && burningEnemy) {
      afterEffects = addForgeToPlayer(
        afterEffects,
        s.gearEffects.forgeOnCompanionDamageVsBurningChances.reduce(
          (total, chance) => total + Number(rollBattleChance(chance, afterEffects)),
          0,
        ),
        texts,
      );
    }
    if (
      damageDealt > 0 &&
      afterEffects.gearEffects.healOnCompanionAttack > 0 &&
      // Kill healing must not cancel eligibility; retaliation can also move
      // the player below half Health during this Companion action.
      (s.playerHealth < s.playerMaxHealth / HALF_DIVISOR ||
        afterEffects.playerHealth < afterEffects.playerMaxHealth / HALF_DIVISOR)
    ) {
      afterEffects = applyHealingWithCombatText(afterEffects, afterEffects.gearEffects.healOnCompanionAttack, texts);
    }

    if (damageDealt > 0 && afterEffects.enemyHealth > 0 && state.talentEffects.companionStunChance > 0) {
      if (rollBattleChance(state.talentEffects.companionStunChance, state)) {
        afterEffects = resolveFollowUpHit(
          afterEffects,
          { source: "talent-derived", damageType: "stun", amount: damageDealt },
          texts,
        );
      }
    }

    if (damageDealt > 0 && state.talentEffects.companionLeechChance > 0) {
      if (rollBattleChance(state.talentEffects.companionLeechChance, state)) {
        afterEffects = applyScaledLeechHealing(afterEffects, computeLeechHeal(damageDealt), texts);
      }
    }

    for (let index = 0; index < damagePackets; index += 1) {
      if (rollBattleChance(afterEffects.talentEffects.companionManaChance, afterEffects)) {
        afterEffects = gainManaWithCombatText(afterEffects, 1, texts);
      }
    }

    return resolvePendingBattleReactions(afterEffects, texts);
  });
  currentGroup.after = health(resolved);
  for (const event of texts) {
    event.companionActionId ??= currentGroup.id;
    const group = groups.find((item) => item.id === event.companionActionId);
    group?.texts.push({ ...event });
    mergeCombatText(combatTexts, event);
  }
  if (companionCard.effects.length) {
    for (const resolution of groups) state.onCompanionAction?.({ ...cue, resolution });
  }
  return resolved;
}
