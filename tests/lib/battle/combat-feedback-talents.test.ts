import { describe, expect, it } from "vitest";
import { computeTalentEffects, type BattleCard } from "@/lib/game-data";
import type { CombatTextEvent } from "@/lib/battle";
import { playBattleCardResolved } from "@/lib/battle/card-play";
import { computeCardDamageToEnemy } from "@/lib/battle/damage-calc";
import { applyWishEffect } from "@/lib/battle/wish";
import { applyLifestealAndPlayerHitTriggers } from "@/lib/battle/follow-up-hit-resolution";
import { PersistedBattleStateSchema } from "@/lib/validation/save-schemas/persisted-battle-state";
import { WISH_CHOICE_COUNT } from "@/lib/game-constants";
import { patchBattleState, type BattleStatePatch } from "../../fixtures/battle";
import { makeTestCard } from "../../fixtures/cards";

function battle(patch: BattleStatePatch = {}) {
  return patchBattleState({
    enemyHealth: 100,
    enemyMaxHealth: 100,
    playerHealth: 10,
    playerMaxHealth: 40,
    currentEnemy: { traits: [] },
    rng: () => 0.99,
    mana: 20,
    maxMana: 20,
    ...patch,
  });
}
function play(state: ReturnType<typeof battle>, card: BattleCard) {
  return playBattleCardResolved({ ...state, hand: [card] }, card.id, 0);
}
function resume(state: ReturnType<typeof battle>) {
  return { ...PersistedBattleStateSchema.parse(JSON.parse(JSON.stringify(state))), rng: () => 0.99 };
}
const holy = makeTestCard({ effects: [{ kind: "damage", damageType: "holy", amount: 1 }] });
const wish = makeTestCard({ effects: [{ kind: "wish", amount: 1 }] });
const intervention = computeTalentEffects({ holy: ["holy-wish-chance"] });
const cull = computeTalentEffects({ leech: ["leech-cull-weak"] });

describe("Divine Intervention", () => {
  it("does not Wish when Block absorbs all Holy damage", () => {
    const result = play(
      battle({
        talentEffects: { ...intervention, holyWishChance: 100 },
        enemyMitigation: { block: 20 },
      }),
      holy,
    );
    expect(result.state.enemyHealth).toBe(100);
    expect(result.state.wishOptions).toBeNull();
    expect(result.state.wishQueue).toEqual([]);
  });

  it("Wishes from positive Holy damage", () => {
    const result = play(battle({ talentEffects: intervention, rng: () => 0.05 }), holy);
    expect(result.state.wishOptions).toHaveLength(WISH_CHOICE_COUNT);
    expect(result.state.flags.nextWishExtraChoice).toBe(false);
  });

  it("queues a separate Wish when the same card also contains a Wish", () => {
    const card = makeTestCard({ effects: [...holy.effects, { kind: "wish", amount: 1 }] });
    const next = play(battle({ talentEffects: intervention, rng: () => 0.05 }), card).state;
    expect(next.wishOptions).toHaveLength(WISH_CHOICE_COUNT);
    expect(next.wishQueue.map((options) => options.length)).toEqual([WISH_CHOICE_COUNT]);
    expect(next.flags.nextWishExtraChoice).toBe(false);
  });

  it("leaves prebuilt choices unchanged and retains the spent state on resume", () => {
    const initial = applyWishEffect(battle({ talentEffects: intervention }), wish, 1, []);
    const ready = { ...initial, flags: { ...initial.flags, nextWishExtraChoice: true } };
    const next = applyWishEffect(ready, wish, 2, []);
    expect(next.wishOptions).toBe(initial.wishOptions);
    expect(next.wishQueue.map((options) => options.length)).toEqual([WISH_CHOICE_COUNT + 1, WISH_CHOICE_COUNT]);
    const restored = resume(next);
    expect(restored.wishOptions).toEqual(next.wishOptions);
    expect(restored.wishQueue).toEqual(next.wishQueue);
    expect(restored.flags.nextWishExtraChoice).toBe(false);
    expect(battle({ talentEffects: intervention }).flags.nextWishExtraChoice).toBe(false);
  });
});

describe("Cull the Weak", () => {
  const leech = makeTestCard({ effects: [{ kind: "damage", damageType: "physical", amount: 8, lifesteal: true }] });
  it.each([
    [51, 8, 4],
    [50, 8, 4],
    [49, 10, 5],
  ] as const)(
    "checks the strict half-Health threshold at %i Health and retains Physical damage and Leech",
    (health, damage, healing) => {
      const result = play(battle({ enemyHealth: health, talentEffects: cull }), leech);
      expect(result.state.enemyHealth).toBe(health - damage);
      expect(result.state.playerHealth).toBe(10 + healing);
      expect(result.combatTexts).toContainEqual({ target: "enemy", kind: "damage", stat: "physical", amount: damage });
      expect(result.combatTexts).not.toContainEqual(expect.objectContaining({ stat: "holy" }));
    },
  );

  it("rechecks each hit as the same card crosses below half Health", () => {
    const card = makeTestCard({ effects: [...leech.effects, ...leech.effects] });
    const result = play(battle({ enemyHealth: 54, talentEffects: cull }), card);
    expect(result.state.enemyHealth).toBe(36);
    expect(result.state.playerHealth).toBe(19);
    expect(result.combatTexts).toContainEqual({ target: "enemy", kind: "damage", stat: "physical", amount: 18 });
  });

  it("uses additive percentages and ordinary rounding and mitigation, excluding companion and incidental hits", () => {
    const effect = { kind: "damage" as const, damageType: "physical" as const, amount: 7, lifesteal: true };
    const card = makeTestCard({ consume: true, effects: [effect] });
    const initial = battle({
      enemyHealth: 49,
      talentEffects: { ...cull, consumeDamageBonusPercent: 20 },
      enemyMitigation: { block: 2 },
    });
    expect(computeCardDamageToEnemy(initial, effect, card).modifiedDamage).toBe(8);
    expect(
      computeCardDamageToEnemy(initial, effect, card, {
        origin: "companion",
        manaAtStart: initial.mana,
        enemyFreezeSkipTurnsAtStart: 0,
      }).modifiedDamage,
    ).toBe(6);
    expect(computeCardDamageToEnemy(initial, effect).modifiedDamage).toBe(5);
    expect(applyLifestealAndPlayerHitTriggers(initial, 8, []).enemyHealth).toBe(49);
  });
});

describe("feedback talent save compatibility", () => {
  it("defaults additive fields while retaining legacy Holy/Wish and Leech/Holy behavior", () => {
    const saved = JSON.parse(
      JSON.stringify(
        battle({
          enemyHealth: 40,
          talentEffects: { holyWishChance: 100, leechHolyDamageVsLowHealth: 1 },
        }),
      ),
    );
    delete saved.flags.nextWishExtraChoice;
    delete saved.talentEffects.wishExtraChoiceAfterHolyCard;
    delete saved.talentEffects.leechCardDamageVsLowHealthPercent;
    const restored = { ...PersistedBattleStateSchema.parse(saved), rng: () => 0.99 };
    expect(restored.flags.nextWishExtraChoice).toBe(false);
    expect(restored.talentEffects.wishExtraChoiceAfterHolyCard).toBe(false);
    expect(restored.talentEffects.leechCardDamageVsLowHealthPercent).toBe(0);
    expect(play(restored, holy).state.wishOptions).toHaveLength(WISH_CHOICE_COUNT);
    const legacyTexts: CombatTextEvent[] = [];
    const hit = applyLifestealAndPlayerHitTriggers(restored, 8, legacyTexts);
    expect(hit.enemyHealth).toBeLessThan(restored.enemyHealth);
    expect(legacyTexts).toContainEqual(expect.objectContaining({ target: "enemy", stat: "holy", kind: "damage" }));
    const withoutLegacy = { ...restored, talentEffects: { ...restored.talentEffects, leechHolyDamageVsLowHealth: 0 } };
    expect(applyLifestealAndPlayerHitTriggers(withoutLegacy, 8, []).enemyHealth).toBe(restored.enemyHealth);
    expect(intervention.holyWishChance).toBe(10);
    expect(cull.leechHolyDamageVsLowHealth).toBe(0);
  });
});
