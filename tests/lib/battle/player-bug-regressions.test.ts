import { describe, expect, it } from "vitest";
import { cardById } from "@/lib/game-data";
import { playBattleCardResolved } from "@/lib/battle/card-play";
import { computeEffectiveCost } from "@/lib/battle/card-cost-rules";
import { applyCardEffects } from "@/lib/battle/effect-handlers";
import { tryTriggerEnemyFreeze } from "@/lib/battle/damage-status-riders";
import { resolveStunTrigger } from "@/lib/battle/status-stun-resolve";
import { makeTestCard, patchBattleState } from "../../fixtures/battle";

describe("player combat regressions", () => {
  it.each(["second-wind", "divine-aegis"])("Icy Heart triggers %s on crossing half Health", (id) => {
    const state = patchBattleState({
      enemyHealth: 54,
      enemyMaxHealth: 100,
      enemyStatuses: { freeze: 100 },
      currentEnemy: { traits: [{ id, title: id, description: "" }] },
      trinketEffects: { frozenHeartDamage: 6 },
    });
    const result = tryTriggerEnemyFreeze(state, state, []);
    expect(id === "second-wind" ? result.flags.secondWindTriggered : result.flags.divineAegisTriggered).toBe(true);
    expect(result.enemyHealth).toBe(id === "second-wind" ? 68 : 48);
  });

  it("Mana Flare adds Burn buildup and decays enemy Armor", () => {
    const state = patchBattleState({
      enemyHealth: 100,
      enemyMaxHealth: 100,
      maxMana: 4,
      enemyMitigation: { armor: 3 },
      talentEffects: { burnDamageOnManaCrystalLoss: 3 },
    });
    const card = makeTestCard({ effects: [{ kind: "lose-max-mana", amount: 1 }] });
    const result = applyCardEffects(state, card, []);
    expect(result.enemyHealth).toBe(97);
    expect(result.enemyStatuses.burn).toBe(3);
    expect(result.enemyMitigation.armor).toBe(2);
  });

  it.each(["pack-tactics", "wolf-companion"])(
    "Hunter's Bond draws once per %s play even with repeated effects",
    (id) => {
      const card = { ...cardById[id]!, uid: 1 };
      const state = patchBattleState({
        hand: [card],
        deck: [makeTestCard({ id: "draw-a" }), makeTestCard({ id: "draw-b" })],
        enemyHealth: 100,
        enemyMaxHealth: 100,
        talentEffects: { drawOnCompanionCard: 1 },
        flags: { playNextCardTwice: true },
        rng: () => 0.99,
      });
      const result = playBattleCardResolved(state, id, 0).state;
      expect(result.hand).toHaveLength(1);
      expect(result.deck).toHaveLength(1);
    },
  );

  it("Whistle makes Pack Tactics free and spends the discount on that play", () => {
    const card = { ...cardById["pack-tactics"]!, uid: 1 };
    const state = patchBattleState({ hand: [card], mana: 0, talentEffects: { firstCompanionCardFree: true } });
    expect(computeEffectiveCost(state, card).effectiveCost).toBe(0);
    const result = playBattleCardResolved(state, card.id, 0).state;
    expect(result.flags.firstCompanionCardFreeUsed).toBe(true);
    expect(result.hand).toHaveLength(0);
  });

  it("Thunderstone cannot reward damage after Stun gear kills the enemy", () => {
    const state = patchBattleState({
      enemyHealth: 5,
      enemyMaxHealth: 100,
      enemyStatuses: { stun: 100 },
      mana: 0,
      gearEffects: { damageOnStunPhysical: 5, manaOnNatureDamageChance: 100 },
      trinketEffects: { thunderstoneDamageOnStun: 6 },
    });
    const result = resolveStunTrigger(state, []);
    expect(result.enemyHealth).toBe(0);
    expect(result.mana).toBe(0);
  });
});
