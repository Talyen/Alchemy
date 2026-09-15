import { describe, expect, it } from "vitest";
import { drawCards, resolveBattleTurn } from "@/lib/battle";
import { paceCombatDamage } from "@/lib/battle/fight-pacing";
import { makeTestBattleState, slashDeck } from "../../fixtures/battle";
import { seededRng } from "../../fixtures/rng";

// Scale smoke tests: the frame profiler cannot see simulation cost, so these
// pin that hot battle paths complete bulk work. They assert completion and
// sanity — not wall-clock thresholds — so they stay stable on slow machines
// while still timing out loudly on accidental quadratic work.
describe("battle engine cost at scale", () => {
  it("resolves 10k paced magnitudes deterministically", () => {
    const state = makeTestBattleState({ appliesFightPacing: true, turn: 30 });
    let total = 0;
    for (let i = 0; i < 10_000; i += 1) {
      total += paceCombatDamage(state, 12, "player");
    }
    expect(total).toBe(10_000 * paceCombatDamage(state, 12, "player"));
    expect(Number.isFinite(total)).toBe(true);
  });

  it("cycles a full deck through draws without losing cards", () => {
    let deck = slashDeck(30);
    let discard: typeof deck = [];
    let hand: typeof deck = [];
    let uid = 1;
    const rng = seededRng(7);
    for (let i = 0; i < 200; i += 1) {
      const drawn = drawCards(deck, discard, hand, 4, uid, rng);
      deck = drawn.deck;
      discard = [...drawn.discard, ...drawn.hand];
      hand = [];
      uid = drawn.nextCardUid;
    }
    expect(deck.length + discard.length).toBe(30);
    expect(uid).toBeGreaterThan(1);
  });

  it("resolves 300 end turns against a damage sponge", () => {
    let snapshot = makeTestBattleState({
      enemyHealth: 1_000_000,
      enemyMaxHealth: 1_000_000,
      playerHealth: 1_000_000,
      playerMaxHealth: 1_000_000,
      deck: slashDeck(20),
      rng: seededRng(11),
    });
    let turns = 0;
    for (let i = 0; i < 300; i += 1) {
      const resolved = resolveBattleTurn(snapshot, { rng: seededRng(11 + i) });
      snapshot = { ...snapshot, ...resolved.state };
      turns += resolved.frames.length;
    }
    expect(turns).toBeGreaterThan(0);
    expect(Number.isFinite(snapshot.enemyHealth)).toBe(true);
  });
});
