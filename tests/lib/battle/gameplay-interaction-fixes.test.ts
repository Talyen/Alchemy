import { describe, expect, it, vi } from "vitest";
import { playBattleCardResolved } from "@/lib/battle/card-play";
import { resolveBattleTurn } from "@/lib/battle/enemy-turn";
import { resolveEnemyAttackHit } from "@/lib/battle/enemy-attack-hit";
import { cardById } from "@/lib/game-data";
import { makeTestCard, patchBattleState } from "../../fixtures/battle";

describe("gameplay interaction regressions", () => {
  it("Leyline's free cast preserves Block used as missing Mana", () => {
    const card = cardById["cold-snap"]!;
    const state = patchBattleState({
      hand: [card],
      mana: 0,
      playerStatuses: { block: 3 },
      gearEffects: { blockPaysFreezeMana: 1 },
      talentEffects: { homesteadFreeManaChance: 100 },
      rng: () => 0.99,
    });
    const result = playBattleCardResolved(state, card.id, 0);
    expect(result.state.cardsPlayedThisTurn).toBe(1);
    expect(result.state.playerStatuses.block).toBe(3);
    expect(result.combatTexts).not.toContainEqual(expect.objectContaining({ target: "player", stat: "block" }));
  });

  it.each(["stunSkipTurns", "freezeSkipTurns"] as const)("resolves %s until the hero can act again", (status) => {
    const state = patchBattleState({
      playerCC: { [status]: 2 },
      deck: [makeTestCard()],
      rng: () => 0.99,
    });
    const result = resolveBattleTurn(state, { rng: state.rng });
    expect(result.frames).toHaveLength(2);
    expect(result.frames[0]!.turn.playerTurnSkipped).toBe(true);
    expect(result.state.playerCC[status]).toBe(0);
    expect(result.state.turnPhase).toBe("player");
  });

  it("Runic Quill draws for both consumed cards in the same turn", () => {
    const first = { ...cardById["mana-potion"]!, uid: 1 };
    const second = { ...first, uid: 2 };
    const state = patchBattleState({
      hand: [first, second],
      deck: [makeTestCard({ id: "draw-two" }), makeTestCard({ id: "draw-one" })],
      trinketEffects: { runicQuillDrawOnConsume: 1 },
    });
    const once = playBattleCardResolved(state, first.id, 0).state;
    const twice = playBattleCardResolved(once, second.id, 0).state;
    expect(twice.exhausted).toHaveLength(2);
    expect(twice.hand.map((card) => card.id)).toEqual(["draw-one", "draw-two"]);
  });

  it("Riposting does not spend a critical hit prepared for the next card", () => {
    const rng = vi
      .fn(() => 0.99)
      .mockReturnValueOnce(0)
      .mockReturnValueOnce(0);
    const state = patchBattleState({
      flags: { nextHitCrit: true },
      gearEffects: { physicalOnDodge: 4 },
      rng,
    });
    const result = resolveEnemyAttackHit(state, { kind: "damage", damageType: "physical", amount: 4 }, [], {
      canDodge: true,
    });
    expect(result.dodged).toBe(true);
    expect(result.state.flags.nextHitCrit).toBe(true);
    expect(result.state.enemyHealth).toBe(state.enemyHealth - 4);
  });

  it.each([false, true])("Combustible resolves retaliation before Aftertaste; protected=%s", (protectedHero) => {
    const card = cardById["mana-potion"]!;
    const state = patchBattleState({
      hand: [card],
      playerHealth: 1,
      deathsDoorUsed: !protectedHero,
      enemyStatuses: { burn: 2 },
      currentEnemy: { traits: [{ id: "cinder-skin", title: "Cinder Skin", description: "" }] },
      talentEffects: { consumeDetonatesBurn: true, healOnConsume: 1 },
      rng: () => 0.99,
    });
    const result = playBattleCardResolved(state, card.id, 0).state;
    expect(result.playerHealth).toBe(protectedHero ? 2 : 0);
    expect(result.deathsDoorUsed).toBe(true);
    expect(result.exhausted).toHaveLength(1);
    expect(result.flags.pendingCinderSkinReaction).toBe(false);
  });
});
