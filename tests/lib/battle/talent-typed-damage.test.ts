import { describe, expect, it } from "vitest";
import { cardById, computeTalentEffects, type DamageType } from "@/lib/game-data";
import { dealTalentTypedHit, tryTalentTypedHit } from "@/lib/battle/player-typed-hit";
import { applyDamageRiders } from "@/lib/battle/damage-riders";
import { applyLifestealAndPlayerHitTriggers } from "@/lib/battle/player-typed-hit";
import { payKillPayouts } from "@/lib/battle/combat-text";
import { tickEnemyStatuses } from "@/lib/battle/status-ticks";
import { detonateEnemyStatuses } from "@/lib/battle/dot-resolve";
import { PersistedBattleStateSchema } from "@/lib/validation/save-schemas/persisted-battle-state";
import { patchBattleState, type BattleStatePatch } from "../../fixtures/battle";
import { makeTestCard } from "../../fixtures/cards";

function battle(patch: BattleStatePatch = {}) {
  return patchBattleState({
    enemyHealth: 100,
    enemyMaxHealth: 100,
    playerHealth: 10,
    playerMaxHealth: 40,
    rng: () => 0.09,
    ...patch,
  });
}

const converted = computeTalentEffects({
  physical: ["physical-lacerate"],
  archery: ["archery-broadhead"],
  bleed: ["bleed-poison-chance"],
  nature: ["nature-toxic-pollen"],
  holy: ["holy-burn-chance"],
  leech: ["leech-bleed-chance", "leech-poison"],
});

describe("talent damage conversions", () => {
  it.each([
    ["physical", "bleed", 2, 2],
    ["bleed", "poison", 4, 4],
    ["nature", "poison", 4, 4],
    ["holy", "burn", 4, 4],
  ] as const)(
    "converts %s procs into a mitigated %s hit and its intrinsic status",
    (source, target, damage, stacks) => {
      const state = battle({ talentEffects: converted });
      const card = makeTestCard({ effects: [{ kind: "damage", damageType: source, amount: 8 }] });
      const next = applyDamageRiders(state, card, { kind: "damage", damageType: source, amount: 8 }, 8, []);
      expect(next.enemyHealth).toBe(92 - damage);
      expect(next.enemyStatuses[target]).toBe(stacks);
      if (source === "physical") expect(next.enemyStatuses.poison).toBe(0);
    },
  );

  it("Broadhead deals a separate Bleed hit on an Archery hit", () => {
    const next = applyDamageRiders(
      battle({ talentEffects: { archeryBleedDamageChance: 10 } }),
      cardById["bounty-shot"]!,
      { kind: "damage", damageType: "physical", amount: 8 },
      8,
      [],
    );
    expect(next.enemyHealth).toBe(90);
    expect(next.enemyStatuses.bleed).toBe(2);
  });

  it("Leech can trigger both damage types without those secondary hits triggering further procs", () => {
    const next = applyLifestealAndPlayerHitTriggers(battle({ talentEffects: converted }), 8, []);
    expect(next.enemyHealth).toBe(94);
    expect(next.enemyStatuses).toMatchObject({ bleed: 2, poison: 4 });
  });

  it("does not apply a chance proc on a failed roll or zero damage", () => {
    const initial = battle({ rng: () => 0.99 });
    expect(tryTalentTypedHit(initial, 10, "burn", 8, [])).toBe(initial);
    expect(tryTalentTypedHit(initial, 100, "burn", 0, [])).toBe(initial);
  });

  it("derived hits do not reuse offensive bonuses, pacing, Forge, critical strikes, or reserved card bonuses", () => {
    const initial = battle({
      appliesFightPacing: true,
      turn: 20,
      playerStatuses: { forge: 50 },
      flags: { nextHitCrit: true, nextHitPhysicalBonus: 40, sanguinePhysicalBonus: 3 },
      talentEffects: { flatBurnDamage: 100, forgeToBurn: true, burnDamagePerManaCrystal: 100 },
    });
    const next = tryTalentTypedHit(initial, 100, "burn", 8, []);
    expect(next.enemyHealth).toBe(96);
    expect(next.enemyStatuses.burn).toBe(4);
    expect(next.playerStatuses.forge).toBe(50);
    expect(next.flags).toEqual(initial.flags);
  });

  it("applies target resistance and Block to the derived amount before creating statuses", () => {
    const initial = battle({
      currentEnemy: { traits: [{ id: "burn-resistance", title: "", description: "" }] },
      enemyMitigation: { block: 1 },
    });
    const next = dealTalentTypedHit(initial, "burn", 4, [], true);
    expect(next.enemyMitigation.block).toBe(0);
    expect(next.enemyHealth).toBe(99);
    expect(next.enemyStatuses.burn).toBe(1);
  });

  it.each(["physical", "stun"] as DamageType[])("%s follow-ups respect Armor as well as Block", (type) => {
    const initial = battle({ enemyMitigation: { block: 2, armor: 2 } });
    const next = dealTalentTypedHit(initial, type, 4, [], true);
    expect(next.enemyHealth).toBe(100);
    expect(next.enemyMitigation.block).toBe(0);
    expect(next.enemyMitigation.armor).toBe(2);
  });

  it("crowd-control immunity prevents buildup without removing the damage", () => {
    const initial = battle({ enemyCC: { cooldown: 2 } });
    const next = dealTalentTypedHit(initial, "freeze", 4, [], true);
    expect(next.enemyHealth).toBe(96);
    expect(next.enemyStatuses.freeze).toBe(0);
  });

  it("fully absorbed hits create no statuses or damage rewards", () => {
    const initial = battle({ enemyMitigation: { block: 10 }, talentEffects: { forgeOnBurnDealt: 1 } });
    const next = dealTalentTypedHit(initial, "burn", 4, [], true);
    expect(next.enemyHealth).toBe(100);
    expect(next.enemyStatuses.burn).toBe(0);
    expect(next.playerStatuses.forge).toBe(0);
  });

  it("fixed triggers preserve the next card’s critical strike and do not roll damage procs", () => {
    const initial = battle({ talentEffects: converted, flags: { nextHitCrit: true } });
    const next = dealTalentTypedHit(initial, "bleed", 4, []);
    expect(next.enemyHealth).toBe(96);
    expect(next.enemyStatuses.bleed).toBe(4);
    expect(next.enemyStatuses.poison).toBe(0);
    expect(next.flags.nextHitCrit).toBe(true);
  });
});

describe("Toxic Profit and saved damage rules", () => {
  const effects = computeTalentEffects({ poison: ["poison-gold-first"] });

  it.each(["hit", "tick", "detonation", "trigger"] as const)(
    "pays a Poisoned kill through %s exactly once",
    (source) => {
      const initial = battle({
        enemyHealth: 2,
        enemyStatuses: { poison: 3 },
        talentEffects: effects,
        trinketEffects: { boneCharmHealOnKill: 2 },
      });
      const next =
        source === "hit"
          ? applyDamageRiders(initial, cardById["slash"]!, { kind: "damage", damageType: "physical", amount: 4 }, 4, [])
          : source === "tick"
            ? tickEnemyStatuses(initial, [])
            : source === "detonation"
              ? detonateEnemyStatuses(initial, ["poison"], [])
              : dealTalentTypedHit(initial, "burn", 4, []);
      expect(next.gold).toBe(3);
      expect(next.playerHealth).toBe(12);
      expect(payKillPayouts(next, true, []).gold).toBe(3);
      expect(payKillPayouts(next, true, []).playerHealth).toBe(12);
    },
  );

  it("also pays when the lethal Poison hit first inflicts Poison", () => {
    const initial = battle({ enemyHealth: 2, talentEffects: effects });
    const next = applyDamageRiders(
      initial,
      cardById["venom-fangs"]!,
      { kind: "damage", damageType: "poison", amount: 4 },
      4,
      [],
    );
    expect(next.gold).toBe(3);
  });

  it("does not pay for an unpoisoned kill or hit an already defeated enemy", () => {
    const initial = battle({ enemyHealth: 1, talentEffects: effects });
    const killed = dealTalentTypedHit(initial, "burn", 4, []);
    expect(killed.gold).toBe(0);
    expect(dealTalentTypedHit(killed, "poison", 4, [])).toBe(killed);
  });

  it("new saved manifests retain converted procs and kill payout state", () => {
    const state = battle({
      talentEffects: { ...converted, ...effects, physicalBleedDamageChance: 10 },
      flags: { killRewardsPaid: true },
    });
    const saved = PersistedBattleStateSchema.parse(JSON.parse(JSON.stringify(state)));
    expect(saved.talentEffects.physicalBleedDamageChance).toBe(10);
    expect(saved.flags.killRewardsPaid).toBe(true);
  });

  it("legacy manifests retain direct-stack procs and default new rules off", () => {
    const raw = JSON.parse(JSON.stringify(battle({ talentEffects: { physicalBleedChance: 10, drawOnConsume: 1 } })));
    delete raw.talentEffects.physicalBleedDamageChance;
    delete raw.talentEffects.uncappedDrawOnConsume;
    delete raw.flags.killRewardsPaid;
    delete raw.flags.nextHolyCardFree;
    const saved = { ...PersistedBattleStateSchema.parse(raw), rng: () => 0.09 };
    expect(saved.talentEffects.physicalBleedDamageChance).toBe(0);
    expect(saved.talentEffects.uncappedDrawOnConsume).toBe(0);
    const hit = applyDamageRiders(
      saved,
      cardById["slash"]!,
      { kind: "damage", damageType: "physical", amount: 8 },
      8,
      [],
    );
    expect(hit.enemyHealth).toBe(92);
    expect(hit.enemyStatuses.bleed).toBe(8);
  });
});
