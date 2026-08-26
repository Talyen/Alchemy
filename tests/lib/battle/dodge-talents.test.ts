import { describe, expect, it } from "vitest";
import { defaultTalentEffects } from "@/lib/battle";
import { processEnemyAttack } from "@/lib/battle/enemy-turn-attack";
import { playBattleCardResolved } from "@/lib/battle/card-play";
import { companionLibrary } from "@/lib/game-data";
import { applyDamageStatuses } from "@/lib/battle/damage-status-riders";
import {
  dealDamage,
  incomingPhysical,
  makeCombatTexts,
  makeEffect,
  makeTestCard,
  patchBattleState,
} from "../../fixtures/battle";
import { defaultEnemyStatusValues, defaultPlayerStatusValues } from "../../fixtures/default-battle-state";

describe("Dodge talent rewrites", () => {
  it("Riposte deals Physical equal to the dodged attack", () => {
    const result = processEnemyAttack(
      incomingPhysical({
        talentEffects: { ...defaultTalentEffects, physicalOnDodgeEqualToAttack: true },
      }),
      makeCombatTexts(),
    );
    expect(result.playerHealth).toBe(100);
    expect(result.enemyHealth).toBe(92);
  });

  it("Footwork grants Block equal to the dodged attack", () => {
    const result = processEnemyAttack(
      incomingPhysical({
        playerStatuses: defaultPlayerStatusValues({ block: 0 }),
        talentEffects: { ...defaultTalentEffects, blockOnDodgeEqualToAttack: true },
      }),
      makeCombatTexts(),
    );
    expect(result.playerStatuses.block).toBe(8);
  });

  it("Last Gasp adds Dodge chance while at or below half Health", () => {
    const wounded = patchBattleState({
      playerHealth: 10,
      playerMaxHealth: 30,
      rng: () => 0.15,
      enemyAttackEffects: [{ kind: "damage", damageType: "physical", amount: 8 }],
      talentEffects: { ...defaultTalentEffects, dodgeChanceBelowHalfHealth: 20 },
    });
    expect(processEnemyAttack(wounded, makeCombatTexts()).playerHealth).toBe(10);

    const healthy = patchBattleState({
      playerHealth: 30,
      playerMaxHealth: 30,
      rng: () => 0.15,
      enemyAttackEffects: [{ kind: "damage", damageType: "physical", amount: 8 }],
      talentEffects: { ...defaultTalentEffects, dodgeChanceBelowHalfHealth: 20 },
    });
    expect(processEnemyAttack(healthy, makeCombatTexts()).playerHealth).toBeLessThan(30);
  });

  it("Pack Weave makes the Companion attack when you Dodge", () => {
    const result = processEnemyAttack(
      incomingPhysical({
        activeCompanion: companionLibrary.wolf,
        talentEffects: { ...defaultTalentEffects, companionAttacksOnDodge: true },
      }),
      makeCombatTexts(),
    );
    expect(result.enemyHealth).toBeLessThan(100);
  });

  it("Torpor stops poisoned enemies from Dodging", () => {
    const state = patchBattleState({
      enemyHealth: 30,
      enemyStatuses: defaultEnemyStatusValues({ poison: 4 }),
      rng: () => 0.01,
      talentEffects: { ...defaultTalentEffects, poisonPreventsEnemyDodge: true },
    });
    const result = dealDamage(state, makeTestCard({ effects: [makeEffect("physical", 5)] }));
    expect(result.enemyHealth).toBeLessThan(30);
  });

  it("Parting Cut makes the next Physical card deal matching Bleed", () => {
    const afterDodge = processEnemyAttack(
      incomingPhysical({
        talentEffects: { ...defaultTalentEffects, partingCutOnDodge: true },
      }),
      makeCombatTexts(),
    );
    expect(afterDodge.flags.nextPhysicalDealsBleed).toBe(true);

    const result = dealDamage(afterDodge, makeTestCard({ effects: [makeEffect("physical", 6)] }));
    expect(result.enemyHealth).toBe(88);
    expect(result.enemyStatuses.bleed).toBeGreaterThan(0);
    expect(result.flags.nextPhysicalDealsBleed).toBe(false);
  });

  it("Icebound strips enemy Block on Freeze and prevents Dodge while Frozen", () => {
    const freezeState = patchBattleState({
      enemyHealth: 30,
      enemyMaxHealth: 30,
      enemyMitigation: { armor: 0, block: 7, forge: 0 },
      enemyStatuses: defaultEnemyStatusValues({ freeze: 15 }),
      talentEffects: { ...defaultTalentEffects, freezeStripBlock: true, freezePreventsEnemyDodge: true },
    });
    const frozen = applyDamageStatuses(freezeState, { kind: "damage", damageType: "freeze", amount: 10 }, 10, []);
    expect(frozen.enemyMitigation.block).toBe(0);
    expect(frozen.enemyCC.freezeSkipTurns).toBeGreaterThan(0);

    const result = dealDamage({ ...frozen, rng: () => 0.01 }, makeTestCard({ effects: [makeEffect("physical", 5)] }));
    expect(result.enemyHealth).toBeLessThan(frozen.enemyHealth);
  });

  it("Lucky Foot grants Gold when you Dodge", () => {
    const result = processEnemyAttack(
      incomingPhysical({
        gold: 10,
        talentEffects: { ...defaultTalentEffects, goldOnDodge: 1 },
      }),
      makeCombatTexts(),
    );
    expect(result.gold).toBe(11);
  });

  it("Arrow Dance makes the next Archery card free", () => {
    const afterDodge = processEnemyAttack(
      incomingPhysical({
        talentEffects: { ...defaultTalentEffects, nextArcheryCardFreeOnDodge: true },
      }),
      makeCombatTexts(),
    );
    expect(afterDodge.flags.nextArcheryCardFree).toBe(true);

    const card = makeTestCard({
      id: "quick-shot",
      cost: 2,
      tags: ["archery"],
      effects: [makeEffect("physical", 5)],
    });
    const played = playBattleCardResolved({ ...afterDodge, hand: [card], mana: 2 }, card.id, 0);
    expect(played.state.mana).toBe(2);
    expect(played.state.flags.nextArcheryCardFree).toBe(false);
  });

  it("Windstep makes the next Nature card free", () => {
    const afterDodge = processEnemyAttack(
      incomingPhysical({
        talentEffects: { ...defaultTalentEffects, nextNatureCardFreeOnDodge: true },
      }),
      makeCombatTexts(),
    );
    expect(afterDodge.flags.nextNatureCardFree).toBe(true);

    const card = makeTestCard({
      id: "thorns",
      cost: 2,
      effects: [makeEffect("nature", 5)],
    });
    const played = playBattleCardResolved({ ...afterDodge, hand: [card], mana: 2 }, card.id, 0);
    expect(played.state.mana).toBe(2);
    expect(played.state.flags.nextNatureCardFree).toBe(false);
  });
});
