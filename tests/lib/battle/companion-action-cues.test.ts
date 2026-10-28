import { describe, expect, it, vi } from "vitest";
import { battleSnapshot, resolveBattleCard, resolveBattleTurn, type CompanionActionCue } from "@/lib/battle";
import { processCompanionTurnStart } from "@/lib/battle/companion";
import { playBattleCardResolved } from "@/lib/battle/card-play";
import { resolveEnemyAttackHit } from "@/lib/battle/enemy-attack-hit";
import { cardById, companionLibrary } from "@/lib/game-data";
import { patchBattleState, makeTestCard } from "../../fixtures/battle";

describe("resolved Companion action facts", () => {
  it.each([false, true])("retains every Pack Tactics action including full-card repeat=%s", (repeat) => {
    const card = cardById["pack-tactics"]!;
    const make = () =>
      patchBattleState({
        hand: [card],
        activeCompanion: companionLibrary.wolf,
        enemyHealth: 100,
        flags: { playNextCardTwice: repeat },
        rng: vi.fn(() => 0.99),
      });
    const baseline = make();
    const original = playBattleCardResolved(baseline, card.id, 0);
    const state = make();
    const observed = vi.fn();
    const result = resolveBattleCard(battleSnapshot(state), card.id, 0, {
      rng: state.rng,
      onCompanionAction: observed,
    });
    expect(result.companionActions).toEqual(
      Array.from({ length: repeat ? 4 : 2 }, () => ({ companionId: "wolf", kind: "attack" })),
    );
    expect(observed).toHaveBeenCalledTimes(repeat ? 4 : 2);
    expect(result.state).toEqual(battleSnapshot(original.state));
    expect(result.combatTexts).toEqual(original.combatTexts);
    expect(state.rng).toHaveBeenCalledTimes(vi.mocked(baseline.rng).mock.calls.length);
    expect(result.state).not.toHaveProperty("onCompanionAction");
  });

  it.each(["pixie", "mana-moth", "library-owl", "shield-scarab", "will-o-wisp"] as const)(
    "classifies actual %s utility as a cast",
    (id) => {
      const cues: CompanionActionCue[] = [];
      const state = patchBattleState({
        activeCompanion: companionLibrary[id],
        playerHealth: 10,
        deck: [makeTestCard()],
        onCompanionAction: (cue) => cues.push(cue),
      });
      processCompanionTurnStart(state, []);
      expect(cues).toEqual([{ companionId: id, kind: "cast" }]);
    },
  );

  it.each(["mana-moth", "library-owl"] as const)(
    "reports the real %s Bond bonus only when its original roll succeeds",
    (id) => {
      for (const roll of [0.24, 0.25]) {
        const cues: CompanionActionCue[] = [];
        const rng = vi.fn(() => roll);
        const state = patchBattleState({
          activeCompanion: companionLibrary[id],
          deck: [makeTestCard(), makeTestCard()],
          talentEffects: { companionBondLevels: { ...patchBattleState().talentEffects.companionBondLevels, [id]: 1 } },
          rng,
          onCompanionAction: (cue) => cues.push(cue),
        });
        processCompanionTurnStart(state, []);
        expect(cues).toHaveLength(roll < 0.25 ? 2 : 1);
        expect(rng).toHaveBeenCalledTimes(1);
      }
    },
  );

  it("covers immediate summon and Whistle reactions without inventing an action after lethal", () => {
    const card = cardById["wolf-companion"]!;
    const state = patchBattleState({
      hand: [card],
      encounterBenefits: ["eager-pack"],
      talentEffects: { companionActsOnCard: true },
      enemyHealth: 100,
      rng: () => 0.99,
    });
    const result = resolveBattleCard(battleSnapshot(state), card.id, 0, { rng: state.rng });
    expect(result.companionActions).toHaveLength(3);
    const pack = cardById["pack-tactics"]!;
    const lethal = patchBattleState({
      hand: [pack],
      activeCompanion: companionLibrary.wolf,
      enemyHealth: 1,
      rng: () => 0.99,
    });
    expect(resolveBattleCard(battleSnapshot(lethal), pack.id, 0, { rng: lethal.rng }).companionActions).toHaveLength(1);
  });

  it("retains the ordinary turn-start action separately from enemy-turn reactions", () => {
    const state = patchBattleState({
      activeCompanion: companionLibrary.wolf,
      enemyHealth: 100,
      playerHealth: 100,
      playerMaxHealth: 100,
      deck: Array.from({ length: 10 }, () => makeTestCard()),
      rng: () => 0.99,
    });
    const result = resolveBattleTurn(battleSnapshot(state), { rng: state.rng });
    expect(result.frames[0]?.companion?.actions).toEqual([{ companionId: "wolf", kind: "attack" }]);
    expect(result.frames[0]?.companionActions).toEqual([]);
  });

  it.each(["dodge", "block"])("observes a utility Companion's actual %s reaction", (trigger) => {
    const cues: CompanionActionCue[] = [];
    const state = patchBattleState({
      activeCompanion: companionLibrary.pixie,
      playerHealth: 10,
      playerMaxHealth: 40,
      playerStatuses: { block: trigger === "block" ? 1 : 0 },
      talentEffects: {
        companionAttacksOnDodge: trigger === "dodge",
        companionAttackOnBlockDepletedBelowHalf: trigger === "block",
      },
      rng: () => 0,
      onCompanionAction: (cue) => cues.push(cue),
    });
    resolveEnemyAttackHit(state, { kind: "damage", damageType: "physical", amount: 4 }, [], {
      canDodge: trigger === "dodge",
    });
    expect(cues).toEqual([{ companionId: "pixie", kind: "cast" }]);
  });
});
