import { describe, expect, it } from "vitest";
import { playBattleCardResolved } from "@/lib/battle/card-play";
import { tickEnemyStatuses } from "@/lib/battle/status-ticks";
import { detonateEnemyStatuses } from "@/lib/battle/dot-resolve";
import { cardById } from "@/lib/game-data";
import { makeTestCard, patchBattleState } from "../../fixtures/battle";

describe("gameplay bug regressions", () => {
  it("Hawk Eye crits the next packet when the first packet of a card Freezes", () => {
    const card = makeTestCard({
      effects: [
        { kind: "damage", damageType: "freeze", amount: 30 },
        { kind: "damage", damageType: "physical", amount: 4 },
      ],
    });
    const state = patchBattleState({
      hand: [card],
      enemyHealth: 100,
      enemyMaxHealth: 100,
      enemyStatuses: { freeze: 25 },
      talentEffects: { archeryCritOnCrowdControl: true },
      rng: () => 0.99,
    });
    const next = playBattleCardResolved(state, card.id, 0).state;
    expect(next.enemyCC.freezeSkipTurns).toBeGreaterThan(0);
    expect(next.enemyHealth).toBe(62);
    expect(next.flags.hawkEyeReady).toBe(false);
  });

  it("a repeated Mana Shield cannot convert the same Mana twice", () => {
    const card = cardById["mana-shield"]!;
    const state = patchBattleState({ hand: [card], mana: 3, flags: { playNextCardTwice: true }, rng: () => 0.99 });
    const next = playBattleCardResolved(state, card.id, 0).state;
    expect(next.mana).toBe(0);
    expect(next.playerStatuses.block).toBe(9);
  });

  it("Hawk Eye stays armed through full mitigation and is spent on the next damaging packet", () => {
    const card = makeTestCard({ effects: [{ kind: "damage", damageType: "physical", amount: 4 }] });
    const state = patchBattleState({
      hand: [card],
      enemyHealth: 100,
      enemyMaxHealth: 100,
      enemyMitigation: { block: 8 },
      flags: { hawkEyeReady: true },
      talentEffects: { archeryCritOnCrowdControl: true },
      rng: () => 0.99,
    });
    const blocked = playBattleCardResolved(state, card.id, 0).state;
    expect(blocked.enemyHealth).toBe(100);
    expect(blocked.flags.hawkEyeReady).toBe(true);
    const hit = playBattleCardResolved({ ...blocked, hand: [card] }, card.id, 0).state;
    expect(hit.enemyHealth).toBe(92);
    expect(hit.flags.hawkEyeReady).toBe(false);
  });

  it("Distillation does not boost a Potion whose Consume was removed", () => {
    const card = { ...cardById["health-potion"]!, consume: false };
    const state = patchBattleState({
      hand: [card],
      playerHealth: 5,
      playerMaxHealth: 30,
      talentEffects: { potionPotency: 1.1 },
      rng: () => 0.99,
    });
    const next = playBattleCardResolved(state, card.id, 0).state;
    expect(next.playerHealth).toBe(13);
    expect(next.discard).toHaveLength(1);
  });

  it.each(["tick", "detonation"] as const)("Cutpurse Knife pays for a Bleed %s", (source) => {
    const state = patchBattleState({
      enemyHealth: 100,
      enemyMaxHealth: 100,
      enemyStatuses: { bleed: 4 },
      trinketEffects: { cutpurseGoldOnBleed: 1 },
      rng: () => 0.99,
    });
    const next = source === "tick" ? tickEnemyStatuses(state, []) : detonateEnemyStatuses(state, ["bleed"], []);
    expect(next.enemyHealth).toBe(96);
    expect(next.gold).toBe(state.gold + 1);
  });

  it.each([
    { health: 20, bleed: 0, healed: 5 },
    { health: 6, bleed: 0, healed: 3 },
    { health: 6, bleed: 4, healed: 1 },
  ])(
    "Blackfletch's Poison Leech caps healing at Poison Health loss: $health Health, $bleed Bleed",
    ({ health, bleed, healed }) => {
      const card = makeTestCard({
        tags: ["archery"],
        effects: [{ kind: "damage", damageType: "physical", amount: 1 }],
      });
      const state = patchBattleState({
        hand: [card],
        playerHealth: 5,
        playerMaxHealth: 30,
        enemyHealth: health,
        enemyMaxHealth: 100,
        enemyStatuses: { poison: 4, bleed },
        gearEffects: { archeryDetonateBleedPoison: 1 },
        talentEffects: { poisonLeechChance: 100 },
        rng: () => 0.99,
      });
      const next = playBattleCardResolved(state, card.id, 0).state;
      expect(next.enemyStatuses.poison).toBe(0);
      expect(next.playerHealth).toBe(5 + healed);
    },
  );

  it("Blackfletch's Poison detonation can trigger Hemotoxin", () => {
    const card = makeTestCard({ tags: ["archery"], effects: [{ kind: "damage", damageType: "physical", amount: 1 }] });
    const state = patchBattleState({
      hand: [card],
      enemyHealth: 29,
      enemyMaxHealth: 100,
      enemyStatuses: { poison: 4 },
      gearEffects: { archeryDetonateBleedPoison: 1 },
      talentEffects: { poisonBleedDamageChance: 100 },
      rng: () => 0.99,
    });
    const next = playBattleCardResolved(state, card.id, 0).state;
    expect(next.enemyHealth).toBe(8);
    expect(next.enemyStatuses.bleed).toBe(10);
  });

  it("a lethal Poison detonation does not fund later Bleed rewards", () => {
    const draw = makeTestCard({ effects: [{ kind: "gain-gold", amount: 1 }] });
    const state = patchBattleState({
      deck: [draw],
      playerHealth: 5,
      playerMaxHealth: 30,
      enemyHealth: 4,
      enemyMaxHealth: 30,
      enemyStatuses: { poison: 4, bleed: 4 },
      pendingBleedLeechHealing: 4,
      talentEffects: { drawOnBleedDamageChance: 100 },
      trinketEffects: { cutpurseGoldOnBleed: 1 },
      rng: () => 0.99,
    });
    const next = detonateEnemyStatuses(state, ["poison", "bleed"], []);
    expect(next.enemyHealth).toBe(0);
    expect(next.playerHealth).toBe(5);
    expect(next.pendingBleedLeechHealing).toBe(0);
    expect(next.hand).toHaveLength(0);
    expect(next.gold).toBe(state.gold);
  });
});
