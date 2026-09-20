import { applyLeechHealing } from "@/lib/battle/damage-rider-leech";
import { detonateEnemyStatuses } from "@/lib/battle/dot-resolve";
import { endPlayerTurn } from "@/lib/battle/enemy-turn";
import { applyCleanseHeals } from "@/lib/battle/status-player";
import { tickEnemyStatuses } from "@/lib/battle/status-ticks";
import { computeTalentEffects } from "@/lib/game-data";
import { describe, expect, it } from "vitest";
import { makeTestCard } from "../../fixtures/cards";
import * as talentBattle from "../../fixtures/talent-battle";

describe("Talent talent status rewards", () => {
  const { talents, battle, attack, play } = talentBattle;

  it("Sanguine Overflow survives an unselected attack branch until an attack is attempted", () => {
    const state = battle({ flags: { sanguinePhysicalBonus: 3 } });
    const missed = play(
      state,
      makeTestCard({
        effects: [
          {
            kind: "chance",
            probability: 0,
            successEffects: [{ kind: "damage", damageType: "physical", amount: 2 }],
            failureEffects: [],
          },
        ],
      }),
    );
    expect(missed.flags.sanguinePhysicalBonus).toBe(3);
    const after = play(missed, attack("next"));
    expect(missed.enemyHealth - after.enemyHealth).toBe(5);
    expect(after.flags.sanguinePhysicalBonus).toBe(0);
    expect(play({ ...missed, rng: () => 0 }, attack("dodged")).flags.sanguinePhysicalBonus).toBe(0);
  });

  it.each(["poison", "bleed"] as const)(
    "boosts Leech against %s without doubling the bonus for two afflictions",
    (status) => {
      const state = battle({
        playerHealth: 10,
        talentEffects: talents("leech", "leech-nature-chance"),
        enemyStatuses: { [status]: 2 },
      });
      expect(applyLeechHealing(state, 10, []).playerHealth).toBe(21);
      expect(
        applyLeechHealing({ ...state, enemyStatuses: { ...state.enemyStatuses, poison: 2, bleed: 2 } }, 10, [])
          .playerHealth,
      ).toBe(21);
    },
  );

  it("refreshes Sanguine Overflow without stacking or triggering at full Health", () => {
    const state = battle({ playerHealth: 28, talentEffects: talents("leech", "leech-block-enemy") });
    const healed = applyLeechHealing(state, 2, []);
    expect(healed.flags.sanguinePhysicalBonus).toBe(2);
    expect(applyLeechHealing({ ...healed, playerHealth: 29 }, 1, []).flags.sanguinePhysicalBonus).toBe(2);
    const hit = play(healed, attack("multi", "physical", 2));
    expect(healed.enemyHealth - hit.enemyHealth).toBe(4);
    expect(hit.flags.sanguinePhysicalBonus).toBe(0);
    expect(applyLeechHealing(hit, 4, []).flags.sanguinePhysicalBonus).toBe(0);
  });

  it("Bloodrush draws on a normal Bleed tick, never on application or detonation", () => {
    const state = battle({
      talentEffects: talents("bleed", "bleed-rip-and-tear"),
      deck: [attack("drawn")],
      enemyStatuses: { bleed: 2 },
    });
    expect(tickEnemyStatuses(state, []).hand.map((card) => card.id)).toEqual(["drawn"]);
    expect(detonateEnemyStatuses(state, ["bleed"], []).hand).toEqual([]);
    expect(
      play({ ...state, enemyStatuses: { ...state.enemyStatuses, bleed: 0 } }, attack("bleed", "bleed")).hand,
    ).toEqual([]);
    expect(endPlayerTurn(state).state.hand.map((card) => card.id)).toContain("drawn");
  });

  it("Clean Slate cannot recursively cleanse through Cleansing Status healing", () => {
    const card = makeTestCard({ id: "heal", effects: [{ kind: "heal", amount: 2 }] });
    const state = battle({
      talentEffects: talents("health", "health-campfire", "health-max-2"),
      playerStatuses: { poison: 3, bleed: 3, burn: 3 },
    });
    const healed = play(state, card);
    expect(
      [healed.playerStatuses.poison, healed.playerStatuses.bleed, healed.playerStatuses.burn].filter(
        (value) => value === 0,
      ),
    ).toHaveLength(1);
    expect(applyCleanseHeals(state).playerStatuses).toEqual(state.playerStatuses);
    const exact = play({ ...state, playerHealth: 28 }, card);
    expect(exact.playerStatuses).toEqual(state.playerStatuses);
  });

  it("card Leech can trigger Clean Slate and Sanguine Overflow without recursive healing", () => {
    const state = battle({
      playerHealth: 29,
      playerStatuses: { poison: 3, bleed: 3 },
      talentEffects: computeTalentEffects({
        leech: ["leech-block-enemy"],
        health: ["health-campfire", "health-max-2"],
      }),
    });
    const leech = makeTestCard({
      id: "leech",
      cost: 1,
      effects: [{ kind: "damage", damageType: "physical", amount: 4, lifesteal: true }],
    });
    const after = play(state, leech);
    expect(after.playerHealth).toBe(30);
    expect(after.flags.sanguinePhysicalBonus).toBe(2);
    expect([after.playerStatuses.poison, after.playerStatuses.bleed].filter((value) => value === 0)).toHaveLength(1);
  });
});
