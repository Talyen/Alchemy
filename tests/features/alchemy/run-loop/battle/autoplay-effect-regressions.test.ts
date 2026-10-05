import { describe, expect, it } from "vitest";
import { canPlayCard, playBattleCardResolved } from "@/lib/battle";
import { cardById, companionLibrary } from "@/lib/game-data";
import { findBestPlayableHandCard } from "@/features/alchemy/run-loop/battle/playable-hand";
import { makeTestCard, patchBattleState } from "../../../../fixtures/battle";

function readyBattle(patch: Parameters<typeof patchBattleState>[0]) {
  return patchBattleState({
    playerHealth: 30,
    playerMaxHealth: 30,
    enemyHealth: 100,
    enemyMaxHealth: 100,
    mana: 3,
    maxMana: 3,
    rng: () => 0.99,
    ...patch,
  });
}

describe("autoplay effect regressions", () => {
  it("recognizes Smelling Salts as defense against existing control buildup", () => {
    const state = readyBattle({
      playerHealth: 10,
      playerStatuses: { stun: 2, freeze: 2 },
      hand: [cardById.slash!, cardById["smelling-salts"]!],
    });
    const pick = findBestPlayableHandCard(state)!;
    expect(pick.card.id).toBe("smelling-salts");
    const result = playBattleCardResolved(state, pick.card.id, pick.index).state;
    expect(result.playerStatuses).toMatchObject({ stun: 0, freeze: 0 });
  });

  it("recognizes Shadowstep's guaranteed Dodge as defense at low Health", () => {
    const attack = makeTestCard({ effects: [{ kind: "damage", damageType: "physical", amount: 9 }] });
    const state = readyBattle({ playerHealth: 10, hand: [attack, cardById.shadowstep!] });
    const pick = findBestPlayableHandCard(state)!;
    expect(pick.card.id).toBe("shadowstep");
    expect(playBattleCardResolved(state, pick.card.id, pick.index).state.flags.dodgeNextAttack).toBe(true);
  });

  it("values both Wishes from Faustian Bargain instead of treating it as one Wish", () => {
    const state = readyBattle({ hand: [cardById.wish!, cardById["faustian-bargain"]!] });
    const pick = findBestPlayableHandCard(state)!;
    expect(pick.card.id).toBe("faustian-bargain");
    const result = playBattleCardResolved(state, pick.card.id, pick.index).state;
    expect(result.wishOptions).not.toBeNull();
    expect(result.wishQueue).toHaveLength(1);
  });

  it("uses Bond and equipment damage when choosing an active Companion action", () => {
    const state = readyBattle({
      activeCompanion: companionLibrary.skeleton,
      talentEffects: { companionBondLevels: { skeleton: 3 } },
      trinketEffects: { companionDamageBonus: 1 },
      hand: [
        makeTestCard({ effects: [{ kind: "damage", damageType: "physical", amount: 7 }] }),
        cardById["pack-tactics"]!,
      ],
    });
    const pick = findBestPlayableHandCard(state)!;
    expect(pick.card.id).toBe("pack-tactics");
    const result = playBattleCardResolved(state, pick.card.id, pick.index).state;
    expect(result.enemyHealth).toBe(90);
    expect(result.wishOptions).toBeNull();
  });

  it("values Mana Crystals' immediate Mana so a weakened attack does not strand the Crystal", () => {
    const weak = makeTestCard({ id: "slash", effects: [{ kind: "damage", damageType: "physical", amount: 1 }] });
    const state = readyBattle({ mana: 1, hand: [weak, cardById["mana-crystals"]!] });
    const pick = findBestPlayableHandCard(state)!;
    expect(pick.card.id).toBe("mana-crystals");
    const result = playBattleCardResolved(state, pick.card.id, pick.index).state;
    expect(result.maxMana).toBe(4);
    expect(canPlayCard(result, result.hand[0]!, 0)).toBe(true);
  });

  it("does not spend Mana refreshing Shadowstep when both preparations are already armed", () => {
    const weak = makeTestCard({ id: "slash", effects: [{ kind: "damage", damageType: "physical", amount: 2 }] });
    const state = readyBattle({
      hand: [cardById.shadowstep!, weak],
      flags: { playNextCardTwice: true, dodgeNextAttack: true },
    });
    const pick = findBestPlayableHandCard(state)!;
    expect(pick.card.id).toBe("slash");
    const result = playBattleCardResolved(state, pick.card.id, pick.index).state;
    expect(result.flags.playNextCardTwice).toBe(false);
    expect(result.flags.dodgeNextAttack).toBe(true);
    expect(result.hand[0]?.id).toBe("shadowstep");
  });
});
