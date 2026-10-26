import { describe, expect, it } from "vitest";
import { createBattleStartState } from "@/lib/battle/battle-setup";
import { getModifiedCompanionEffects, companionLibrary, cloneBattleCard } from "@/lib/game-data";
import { resolvePlayerHit } from "@/lib/battle/hit-resolution";
import { dealEnemyScaledDamage } from "@/lib/battle/scaled-damage";
import { tickEnemyStatuses } from "@/lib/battle/status-ticks";
import { detonateEnemyStatuses } from "@/lib/battle/dot-resolve";
import type { CombatTextEvent } from "@/lib/battle";
import { selectCombatSound } from "@/features/alchemy/run-loop/battle/combat-sound-selection";
import { regressionBattle, makeTestCard } from "../../fixtures/battle";

describe("damage packet ownership", () => {
  it("owns empty recursive branches when cloning cards for another run", () => {
    const source = makeTestCard({
      effects: [{ kind: "chance", probability: 0.5, successEffects: [], failureEffects: [] }],
    });
    const cloned = cloneBattleCard(source);
    const chance = cloned.effects[0]!;
    if (chance.kind !== "chance") throw new Error("Expected cloned chance");
    chance.successEffects.push({ kind: "damage", damageType: "physical", amount: 5 });
    expect(source.effects).toEqual([{ kind: "chance", probability: 0.5, successEffects: [], failureEffects: [] }]);
  });
  it("keeps default battle Talents independent across fights", () => {
    const options = { runDeck: [], currentEnemy: regressionBattle().currentEnemy, rng: () => 0.99 };
    const first = createBattleStartState(options);
    const original = first.talentEffects.companionBondLevels.wolf;
    try {
      first.talentEffects.companionBondLevels.wolf = 3;
      const second = createBattleStartState(options);
      expect(second.talentEffects.companionBondLevels.wolf).toBe(0);
    } finally {
      first.talentEffects.companionBondLevels.wolf = original;
    }
  });

  it("applies Companion Bond and damage modifiers inside delayed effect trees", () => {
    const companion = {
      ...companionLibrary.skeleton,
      turnStartEffects: [
        { kind: "repeat-over-turns" as const, remainingTurns: 1, effects: companionLibrary.skeleton.turnStartEffects },
      ],
    };
    const effects = getModifiedCompanionEffects(companion, 2, { damageBonus: 3, damageMultiplier: 2 });
    expect(effects).toEqual([
      {
        kind: "repeat-over-turns",
        remainingTurns: 1,
        effects: [{ kind: "damage", damageType: "physical", amount: 12 }],
      },
    ]);
    expect(companionLibrary.skeleton.turnStartEffects[0]).toMatchObject({ amount: 1 });
  });

  it("retains the displayed reflection while reporting only Health actually lost", () => {
    const state = regressionBattle({
      enemyHealth: 2,
      enemyMaxHealth: 30,
      talentEffects: { holyReflectionBlockLostPercent: 100 },
    });
    const texts: CombatTextEvent[] = [];
    const next = resolvePlayerHit(state, { source: "reflected-holy", blockLost: 10 }, texts);
    expect(next.enemyHealth).toBe(0);
    expect(texts).toContainEqual(
      expect.objectContaining({ target: "enemy", kind: "damage", stat: "holy", amount: 10, healthLost: 2 }),
    );
    expect(selectCombatSound([...texts, { target: "player", kind: "heal", stat: "health", amount: 3 }], false)).toBe(
      "playerHeal",
    );
  });

  it("captures scaled-hit Health loss before rider healing changes the target", () => {
    const texts: CombatTextEvent[] = [];
    const state = regressionBattle({ enemyHealth: 2, enemyMaxHealth: 30 });
    const next = dealEnemyScaledDamage(state, 10, "nature", texts, {
      riders: (damaged) => ({ ...damaged, enemyHealth: 5 }),
    });
    expect(next.enemyHealth).toBe(5);
    expect(texts).toContainEqual(
      expect.objectContaining({ target: "enemy", kind: "damage", stat: "nature", amount: 10, healthLost: 2 }),
    );
    expect(selectCombatSound([...texts, { target: "player", kind: "heal", stat: "health", amount: 3 }], false)).toBe(
      "playerHeal",
    );
  });

  it("retains natural tick magnitude while reporting clamped Health loss", () => {
    const texts: CombatTextEvent[] = [];
    tickEnemyStatuses(regressionBattle({ enemyHealth: 2, enemyMaxHealth: 30, enemyStatuses: { burn: 10 } }), texts);
    expect(texts).toContainEqual(
      expect.objectContaining({
        target: "enemy",
        kind: "damage",
        stat: "burn",
        amount: 10,
        healthLost: 2,
        periodic: true,
      }),
    );
    expect(selectCombatSound([...texts, { target: "player", kind: "heal", stat: "health", amount: 3 }], false)).toBe(
      "playerHeal",
    );
  });

  it("attributes a combined detonation's overkill in pulse order", () => {
    const texts: CombatTextEvent[] = [];
    const state = regressionBattle({ enemyHealth: 3, enemyMaxHealth: 30, enemyStatuses: { burn: 2, poison: 5 } });
    const next = detonateEnemyStatuses(state, ["burn", "poison"], texts);
    expect(next.enemyHealth).toBe(0);
    expect(texts).toContainEqual(expect.objectContaining({ target: "enemy", kind: "damage", stat: "burn", amount: 2 }));
    expect(texts).toContainEqual(
      expect.objectContaining({ target: "enemy", kind: "damage", stat: "poison", amount: 5, healthLost: 1 }),
    );
    expect(selectCombatSound(texts, false)).toBe("hitBurn");
  });
});
