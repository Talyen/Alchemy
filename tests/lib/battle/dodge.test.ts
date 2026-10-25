import { describe, expect, it } from "vitest";
import { applyEnemyAbility } from "@/lib/battle/enemy-turn-attack";
import { playBattleCardResolved } from "@/lib/battle/card-play";
import type { BattleState, CombatTextEvent } from "@/lib/battle/types";
import { companionLibrary } from "@/lib/game-data";
import { applyDamageStatuses } from "@/lib/battle/damage-status-riders";
import { resolveFollowUpHit } from "@/lib/battle/follow-up-hit-resolution";
import { tickEnemyStatuses } from "@/lib/battle/status-ticks";
import {
  dealDamage,
  incomingPhysical,
  makeCombatTexts,
  makeEffect,
  makeTestCard,
  patchBattleState,
} from "../../fixtures/battle";

function enemyHit(state: BattleState, amount = 8, texts: CombatTextEvent[] = []) {
  return applyEnemyAbility(state, makeTestCard({ effects: [makeEffect("physical", amount)] }), texts);
}

describe("Dodge gear affixes", () => {
  it("does not allow an actively Frozen or Stunned enemy to Dodge", () => {
    const frozen = patchBattleState({
      enemyHealth: 100,
      enemyMaxHealth: 100,
      enemyCC: { freezeSkipTurns: 1 },
      rng: () => 0.01,
    });
    expect(dealDamage(frozen, makeTestCard({ effects: [makeEffect("physical", 5)] })).enemyHealth).toBe(90);

    const stunned = { ...frozen, enemyCC: { ...frozen.enemyCC, freezeSkipTurns: 0, stunSkipTurns: 1 } };
    expect(dealDamage(stunned, makeTestCard({ effects: [makeEffect("physical", 5)] })).enemyHealth).toBe(90);
  });

  it.each(["freezeSkipTurns", "stunSkipTurns"] as const)(
    "prevents hero Dodge during %s without spending RNG",
    (control) => {
      const state = incomingPhysical({
        playerHealth: 30,
        playerMaxHealth: 30,
        playerCC: { [control]: 1 },
        rng: () => {
          throw new Error("Disabled Dodge must not roll");
        },
      });
      const texts = makeCombatTexts();
      const result = enemyHit(state, 5, texts);
      expect(result.playerHealth).toBe(25);
      expect(texts).not.toContainEqual(expect.objectContaining({ stat: "dodge" }));
    },
  );

  it("gains Block, Armor, and Health on Dodge", () => {
    const texts = makeCombatTexts();
    const state = incomingPhysical({
      playerStatuses: { block: 0, armor: 0 },
      gearEffects: { blockOnDodge: 4, armorOnDodge: 2, healOnDodge: 5 },
      playerHealth: 20,
    });
    const result = enemyHit(state, 8, texts);
    expect(result.playerHealth).toBe(25);
    expect(result.playerStatuses.block).toBe(4);
    expect(result.playerStatuses.armor).toBe(2);
    expect(texts.some((event) => event.kind === "notice" && event.stat === "dodge")).toBe(true);
  });

  it("keeps Dodge Armor rewards unscaled during fight pacing", () => {
    const state = incomingPhysical({
      appliesFightPacing: true,
      turn: 100,
      playerStatuses: { armor: 0 },
      gearEffects: { armorOnDodge: 2 },
      talentEffects: { ...patchBattleState().talentEffects, armorOnDodge: 3 },
    });
    const texts = makeCombatTexts();
    const result = enemyHit(state, 8, texts);
    expect(result.playerStatuses.armor).toBe(5);
    expect(texts).toContainEqual(
      expect.objectContaining({ target: "player", kind: "status", stat: "armor", amount: 5 }),
    );
  });

  it("deals Physical and Bleed damage on Dodge", () => {
    const state = incomingPhysical({
      rng: (() => {
        let calls = 0;
        return () => (++calls <= 2 ? 0.01 : 0.99);
      })(),
      enemyStatuses: { bleed: 1 },
      gearEffects: { physicalOnDodge: 5, bleedOnDodge: 4 },
    });
    const result = enemyHit(state);
    expect(result.playerHealth).toBe(100);
    expect(result.enemyHealth).toBe(91);
    expect(result.enemyStatuses.bleed).toBeGreaterThan(0);
  });

  it("arms Opening additional Physical on the next attack", () => {
    const afterDodge = enemyHit(
      incomingPhysical({
        gearEffects: { nextAttackPhysicalOnDodge: 4 },
      }),
    );
    expect(afterDodge.flags.nextHitPhysicalBonus).toBe(4);

    const result = dealDamage(afterDodge, makeTestCard({ effects: [makeEffect("physical", 5)] }));
    expect(result.enemyHealth).toBe(91);
    expect(result.flags.nextHitPhysicalBonus).toBe(0);
  });

  it("arms Off-Balance as a guaranteed Crit on the next attack", () => {
    const afterDodge = enemyHit(
      incomingPhysical({
        gearEffects: { nextAttackCritOnDodge: 1 },
      }),
    );
    expect(afterDodge.flags.nextHitCrit).toBe(true);

    const card = makeTestCard({
      id: "strike",
      effects: [makeEffect("physical", 6)],
    });
    const armed = {
      ...afterDodge,
      hand: [card],
      mana: 2,
    };
    const played = playBattleCardResolved(armed, card.id, 0);
    expect(played.state.enemyHealth).toBe(88);
    expect(played.state.flags.nextHitCrit).toBe(false);
  });

  it("adds Opening's Physical damage to a non-Physical attack", () => {
    const state = patchBattleState({
      enemyHealth: 100,
      enemyMaxHealth: 100,
      flags: { nextHitPhysicalBonus: 4 },
      rng: () => 0.99,
    });
    const result = dealDamage(state, makeTestCard({ effects: [makeEffect("holy", 5)] }));
    expect(result.enemyHealth).toBe(91);
    expect(result.flags.nextHitPhysicalBonus).toBe(0);
  });
});

describe("Dodge talent rewrites", () => {
  it.each([
    { health: 10, expected: 10 },
    { health: 30, expected: 22 },
  ])("Last Gasp only grants Dodge below half Health ($health)", ({ health, expected }) => {
    const state = patchBattleState({
      playerHealth: health,
      playerMaxHealth: 30,
      rng: () => 0.15,
      talentEffects: { dodgeChanceBelowHalfHealth: 20 },
    });
    expect(enemyHit(state).playerHealth).toBe(expected);
  });

  it("Pack Weave makes the Companion attack when you Dodge", () => {
    const result = enemyHit(
      incomingPhysical({
        rng: (() => {
          let calls = 0;
          return () => (++calls <= 2 ? 0.01 : 0.99);
        })(),
        activeCompanion: companionLibrary.wolf,
        talentEffects: { companionAttacksOnDodge: true },
      }),
    );
    expect(result.enemyHealth).toBeLessThan(100);
  });

  it("Torpor stops poisoned enemies from Dodging", () => {
    const state = patchBattleState({
      enemyHealth: 30,
      enemyStatuses: { poison: 4 },
      rng: () => 0.01,
      talentEffects: { poisonPreventsEnemyDodge: true },
    });
    const result = dealDamage(state, makeTestCard({ effects: [makeEffect("physical", 5)] }));
    expect(result.enemyHealth).toBeLessThan(30);
  });

  it("Parting Cut makes the next Physical card deal matching Bleed", () => {
    const afterDodge = enemyHit(
      incomingPhysical({
        talentEffects: { partingCutDamagePercent: 100 },
      }),
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
      enemyStatuses: { freeze: 15 },
      talentEffects: { freezeStripBlock: true },
    });
    const frozen = applyDamageStatuses(freezeState, { kind: "damage", damageType: "freeze", amount: 10 }, 10, []);
    expect(frozen.enemyMitigation.block).toBe(0);
    expect(frozen.enemyCC.freezeSkipTurns).toBeGreaterThan(0);

    const result = dealDamage({ ...frozen, rng: () => 0.01 }, makeTestCard({ effects: [makeEffect("physical", 5)] }));
    expect(result.enemyHealth).toBeLessThan(frozen.enemyHealth);
  });

  it.each([0.099, 0.1])("Lucky Foot grants 4 Gold only below its 10%% boundary at %s", (roll) => {
    let calls = 0;
    const result = enemyHit(
      incomingPhysical({
        rng: () => (++calls === 1 ? 0.01 : roll),
        gold: 10,
        talentEffects: { goldOnDodge: 4 },
      }),
    );
    expect(result.playerDodgeCount).toBe(1);
    expect(result.gold).toBe(roll < 0.1 ? 14 : 10);
  });

  it.each([
    { talent: "nextArcheryCardFreeOnDodge", flag: "nextArcheryCardFree", type: "physical", tags: ["archery"] },
    { talent: "nextNatureCardFreeOnDodge", flag: "nextNatureCardFree", type: "nature", tags: [] },
  ] as const)("$talent makes the matching card free and consumes $flag", ({ talent, flag, type, tags }) => {
    const afterDodge = enemyHit(incomingPhysical({ talentEffects: { [talent]: true } }));
    expect(afterDodge.flags[flag]).toBe(true);
    const card = makeTestCard({ cost: 2, tags: [...tags], effects: [makeEffect(type, 5)] });
    const played = playBattleCardResolved({ ...afterDodge, hand: [card], mana: 2 }, card.id, 0);
    expect(played.state.mana).toBe(2);
    expect(played.state.flags[flag]).toBe(false);
  });
});

describe("enemy Dodge", () => {
  it("enemy Dodge preserves defenses and armed hits without granting player hit or Dodge rewards", () => {
    const state = patchBattleState({
      playerHealth: 20,
      enemyHealth: 30,
      enemyMitigation: { armor: 4, block: 10 },
      deck: [makeTestCard()],
      rng: () => 0.01,
      flags: {
        nextHitCrit: true,
        nextHitLeech: true,
        nextHitPoison: true,
        nextHitPhysicalBonus: 5,
        nextPhysicalDealsBleed: true,
      },
      gearEffects: { dodgeDrawAndPlay: 1, blockOnDodge: 5 },
    });
    const texts = makeCombatTexts();
    const result = dealDamage(
      state,
      makeTestCard({ effects: [makeEffect("physical", 10, { lifesteal: true })] }),
      texts,
    );
    expect(result).toMatchObject({
      playerHealth: 20,
      enemyHealth: 30,
      playerStatuses: state.playerStatuses,
      enemyStatuses: state.enemyStatuses,
      enemyMitigation: state.enemyMitigation,
      flags: state.flags,
      deck: state.deck,
    });
    expect(texts).toMatchObject([{ target: "enemy", kind: "notice", stat: "dodge", text: "Dodge" }]);
  });

  it("does not Dodge DoT ticks", () => {
    const state = patchBattleState({
      enemyHealth: 30,
      enemyStatuses: { burn: 8 },
      rng: () => 0.01,
    });
    const next = tickEnemyStatuses(state, makeCombatTexts());
    expect(next.enemyHealth).toBe(22);
  });

  it("does not Dodge follow-up typed hits", () => {
    const state = patchBattleState({
      enemyHealth: 30,
      rng: () => 0.01,
    });
    const result = resolveFollowUpHit(
      state,
      { source: "player-follow-up", damageType: "physical", amount: 6 },
      makeCombatTexts(),
    );
    expect(result.enemyHealth).toBeLessThan(30);
  });
});

it.each([
  { chance: 0, expected: 22 },
  { chance: 3, expected: 30 },
])("player Dodge chance from gear adds $chance gear Dodge chance to the baseline", ({ chance, expected }) => {
  const state = patchBattleState({ playerHealth: 30, rng: () => 0.07, gearEffects: { dodgeChance: chance } });
  expect(enemyHit(state).playerHealth).toBe(expected);
});

describe("dodged player attacks preserve hit flags", () => {
  const burnCard = () => makeTestCard({ effects: [makeEffect("burn", 10)] });
  const dodgeFirstRng = () => {
    let calls = 0;
    return () => {
      calls += 1;
      return calls === 1 ? 0.01 : 0.99;
    };
  };

  it("a dodged burn card preserves the once-per-combat burn double and hit flags", () => {
    const state = patchBattleState({
      rng: dodgeFirstRng(),
      trinketEffects: { firstBurnDoubled: true },
      flags: { nextHitLeech: true, nextHitPhysicalBonus: 3 },
    });
    const result = dealDamage(state, burnCard(), makeCombatTexts());
    expect(result.flags.firstBurnTrinketDoubledUsed).toBe(false);
    expect(result.flags.nextHitLeech).toBe(true);
    expect(result.flags.nextHitPhysicalBonus).toBe(3);
  });

  it("the same burn card consumes the burn double when it is not dodged", () => {
    const state = patchBattleState({
      rng: () => 0.99,
      trinketEffects: { firstBurnDoubled: true },
    });
    const result = dealDamage(state, burnCard(), makeCombatTexts());
    expect(result.flags.firstBurnTrinketDoubledUsed).toBe(true);
  });
});

describe("guaranteed dodge flag (dodgeNextAttack)", () => {
  it("dodges the incoming attack packet, consumes dodgeNextAttack, and triggers dodge rewards", () => {
    const state = incomingPhysical({
      playerHealth: 30,
      playerMaxHealth: 30,
      gearEffects: { blockOnDodge: 4 },
      flags: { dodgeNextAttack: true },
      // RNG that would otherwise fail a normal 5% dodge roll (0.99 > 0.05)
      rng: () => 0.99,
    });
    const texts = makeCombatTexts();
    const result = enemyHit(state, 10, texts);
    expect(result.playerHealth).toBe(30);
    expect(result.flags.dodgeNextAttack).toBe(false);
    expect(result.playerDodgeCount).toBe(1);
    expect(result.playerStatuses.block).toBe(4);
    expect(texts).toContainEqual(expect.objectContaining({ stat: "dodge", text: "Dodge" }));
  });

  it("does not dodge if player is crowd-controlled even with dodgeNextAttack", () => {
    const state = incomingPhysical({
      playerHealth: 30,
      playerMaxHealth: 30,
      playerCC: { stunSkipTurns: 1 },
      flags: { dodgeNextAttack: true },
      rng: () => 0.99,
    });
    const texts = makeCombatTexts();
    const result = enemyHit(state, 10, texts);
    expect(result.playerHealth).toBe(20);
    // Remains unconsumed since dodge wasn't eligible
    expect(result.flags.dodgeNextAttack).toBe(true);
  });
});
