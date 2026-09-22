import { describe, expect, it, vi } from "vitest";
import { playBattleCardResolved } from "@/lib/battle/card-play";
import { tickPlayerStatuses, tickEnemyStatuses } from "@/lib/battle/status-ticks";
import { applyPoisonTalentRiders } from "@/lib/battle/damage-status-riders";
import { resolveEnemyAttackHit } from "@/lib/battle/enemy-attack-hit";
import { cardById } from "@/lib/game-data";
import { makeTestCard, patchBattleState } from "../../fixtures/battle";

describe("combat interaction regressions", () => {
  it.each(["poison", "bleed"] as const)("Block protection halves %s ticks exactly once", (status) => {
    const state = patchBattleState({
      playerHealth: 30,
      playerMaxHealth: 30,
      playerStatuses: { block: 1, [status]: 8 },
      talentEffects: { blockHalvesPoisonDamage: true, blockHalvesBleedDamage: true },
      rng: () => 0.99,
    });
    expect(tickPlayerStatuses(state, []).playerHealth).toBe(26);
  });

  it("Winter's Credit does not earn Forged Bulwark from its Block payment", () => {
    const card = cardById["cold-snap"]!;
    const state = patchBattleState({
      hand: [card],
      mana: 0,
      playerStatuses: { block: 3 },
      gearEffects: { blockPaysFreezeMana: 1 },
      talentEffects: { forgeOnBlockDepleted: 1 },
      rng: () => 0.99,
    });
    const result = playBattleCardResolved(state, card.id, 0).state;
    expect(result.cardsPlayedThisTurn).toBe(1);
    expect(result.playerStatuses.block).toBe(0);
    expect(result.playerStatuses.forge).toBe(0);
  });

  it.each(["poison", "bleed"] as const)("Desperate Siphon doubles triggered %s Leech", (status) => {
    const state = patchBattleState({
      playerHealth: 5,
      playerMaxHealth: 30,
      enemyStatuses: { [status]: 8 },
      pendingBleedLeechHealing: status === "bleed" ? 8 : 0,
      talentEffects: { leechDesperateMultiplier: 100, poisonLeechChance: 100 },
      rng: () => 0.99,
    });
    const result = status === "poison" ? applyPoisonTalentRiders(state, 8, []) : tickEnemyStatuses(state, []);
    expect(result.playerHealth).toBe(13);
  });

  it("a damaging second automatic play triggers Holy Retribution after a utility first play", () => {
    const card = makeTestCard({
      tags: ["burn"],
      effects: [
        {
          kind: "chance",
          probability: 0.5,
          successEffects: [{ kind: "damage", damageType: "burn", amount: 1 }],
          failureEffects: [{ kind: "gain-gold", amount: 1 }],
        },
      ],
    });
    const rng = vi
      .fn(() => 0.99)
      .mockReturnValueOnce(0) // Dodge
      .mockReturnValueOnce(0) // Dance of Blades
      .mockReturnValueOnce(0) // draw
      .mockReturnValueOnce(0.99) // first utility branch
      .mockReturnValueOnce(0); // repeated attack branch
    const state = patchBattleState({
      deck: [card],
      playerHealth: 20,
      playerMaxHealth: 30,
      currentEnemy: { traits: [{ id: "holy-retribution", title: "Holy Retribution", description: "" }] },
      gearEffects: { dodgeDrawAndPlay: 1 },
      talentEffects: { burnCardPlayTwiceChance: 100 },
      rng,
    });
    const result = resolveEnemyAttackHit(state, { kind: "damage", damageType: "physical", amount: 1 }, [], {
      canDodge: true,
    });
    expect(result.dodged).toBe(true);
    expect(result.state.enemyHealth).toBeLessThan(state.enemyHealth);
    expect(result.state.gold).toBe(state.gold + 1);
    expect(result.state.playerHealth).toBe(19);
    expect(result.state.flags.holyRetributionUsedThisTurn).toBe(true);
  });

  it("fatal Cinder Skin from Laughing Guard stops later Dodge healing and rewards", () => {
    const rng = vi.fn(() => 0.99).mockReturnValueOnce(0);
    const state = patchBattleState({
      playerHealth: 1,
      playerMaxHealth: 30,
      deathsDoorUsed: true,
      playerStatuses: { block: 1 },
      currentEnemy: { traits: [{ id: "cinder-skin", title: "Cinder Skin", description: "" }] },
      gearEffects: { dodgeSpendsPreservedBlock: 1, healOnDodge: 2 },
      talentEffects: { nextArcheryCardFreeOnDodge: true },
      rng,
    });
    const result = resolveEnemyAttackHit(state, { kind: "damage", damageType: "physical", amount: 1 }, [], {
      canDodge: true,
    });
    expect(result.dodged).toBe(true);
    expect(result.state.playerHealth).toBe(0);
    expect(result.state.flags.nextArcheryCardFree).toBe(false);
  });
});
