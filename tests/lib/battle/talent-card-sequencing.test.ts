import { processCompanionTurnStart } from "@/lib/battle/companion";
import { advanceToPlayerTurn } from "@/lib/battle/player-turn-transition";
import { companionLibrary } from "@/lib/game-data";
import { describe, expect, it } from "vitest";
import { makeTestCard } from "../../fixtures/cards";
import * as talentBattle from "../../fixtures/talent-battle";

describe("Talent talent card sequencing", () => {
  const { talents, battle, attack, play } = talentBattle;

  it("accumulates Coordinated Strike and spends it on only one Companion damage packet", () => {
    let state = battle({
      talentEffects: talents("companion", "companion-tame"),
      activeCompanion: {
        ...companionLibrary.wolf,
        turnStartEffects: [
          { kind: "damage", damageType: "physical", amount: 1 },
          { kind: "damage", damageType: "physical", amount: 1 },
        ],
      },
    });
    state = play(play(state, attack("1")), attack("2"));
    expect(state.flags.companionNextAttackBonus).toBe(2);
    const after = processCompanionTurnStart(state, []);
    expect(state.enemyHealth - after.enemyHealth).toBe(4);
    expect(after.flags.companionNextAttackBonus).toBe(0);
    expect(after.enemyHealth - processCompanionTurnStart(after, []).enemyHealth).toBe(2);
  });

  it("keeps a Companion bonus through a utility action and consumes a dodged attack", () => {
    const state = battle({
      activeCompanion: companionLibrary["golden-retriever"],
      flags: { companionNextAttackBonus: 4 },
    });
    expect(processCompanionTurnStart(state, []).flags.companionNextAttackBonus).toBe(4);
    expect(
      processCompanionTurnStart({ ...state, activeCompanion: companionLibrary.wolf, rng: () => 0 }, []).flags
        .companionNextAttackBonus,
    ).toBe(0);
  });

  it("Follow-through boosts every damage effect on the second Archery card and resets next turn", () => {
    const arrow = {
      ...attack("arrow"),
      tags: ["archery" as const],
      effects: [
        { kind: "damage" as const, damageType: "physical" as const, amount: 2 },
        { kind: "damage" as const, damageType: "physical" as const, amount: 2 },
      ],
    };
    const state = battle({ talentEffects: talents("archery", "archery-hail") });
    const first = play(state, arrow);
    const second = play(first, arrow);
    const third = play(second, arrow);
    expect(state.enemyHealth - first.enemyHealth).toBe(4);
    expect(first.enemyHealth - second.enemyHealth).toBe(6);
    expect(second.enemyHealth - third.enemyHealth).toBe(4);
    const nextTurn = advanceToPlayerTurn(third);
    expect(nextTurn.enemyHealth - play(nextTurn, arrow).enemyHealth).toBe(4);
  });

  it("Armor Siphon steals before damage once per card, including doubled card effects", () => {
    const card = makeTestCard({
      ...attack("leech", "holy"),
      effects: [
        { kind: "damage", damageType: "holy", amount: 1, lifesteal: true },
        { kind: "damage", damageType: "holy", amount: 1, lifesteal: true },
      ],
    });
    const state = battle({
      talentEffects: talents("leech", "leech-trinket-siphon"),
      enemyMitigation: { armor: 8 },
      flags: { playNextCardTwice: true },
    });
    expect(play(state, card).playerStatuses.armor).toBe(1);
    expect(play({ ...state, enemyMitigation: { ...state.enemyMitigation, armor: 0 } }, card).playerStatuses.armor).toBe(
      0,
    );
  });

  it("Bramblegrowth and Briar Patch no longer depend on card sequences", () => {
    const state = battle({
      rng: () => 0.99,
      talentEffects: {
        ...talents("nature", "nature-natural-armor", "nature-briar-patch"),
        thornsOnNatureDamageChance: 100,
        natureBleedChance: 100,
      },
    });
    const nature = play(state, attack("nature", "nature"));
    expect(nature.playerStatuses.thorns).toBeGreaterThan(0);
    expect(nature.enemyStatuses.bleed).toBeGreaterThan(0);
  });
});
