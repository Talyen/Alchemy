import { describe, expect, it } from "vitest";
import { playBattleCardResolved } from "@/lib/battle/card-play";
import { processEncounterTraitActionDamage } from "@/lib/battle/encounter-trait-events";
import { resolveEnemyAttackHit } from "@/lib/battle/enemy-attack-hit";
import { addForgeToPlayer } from "@/lib/battle/player-rewards";
import { cardById } from "@/lib/game-data";
import type { CombatTextEvent } from "@/lib/battle/types";
import { regressionBattle } from "../../fixtures/battle";

describe("visible Gear and encounter procs", () => {
  it("reports Bloodletting's extra Bleed separately from its Physical hit", () => {
    const card = cardById.slash!;
    const state = regressionBattle({ hand: [card], gearEffects: { physicalBleedChance: 100 } });
    const { state: next, combatTexts } = playBattleCardResolved(state, card.id, 0);
    expect(next.enemyStatuses.bleed).toBeGreaterThan(0);
    expect(combatTexts).toContainEqual(
      expect.objectContaining({
        target: "enemy",
        kind: "multiply",
        stat: "bleed",
        amount: next.enemyStatuses.bleed,
      }),
    );
  });

  it("reports Corrosive's Armor removal in addition to normal Armor decay", () => {
    const card = cardById["acid-potion"]!;
    const state = regressionBattle({
      hand: [card],
      enemyMitigation: { armor: 10 },
      gearEffects: { poisonArmorShredChance: 100 },
    });
    const { state: next, combatTexts } = playBattleCardResolved(state, card.id, 0);
    expect(next.enemyMitigation.armor).toBe(3);
    expect(combatTexts).toContainEqual(
      expect.objectContaining({ target: "enemy", kind: "damage", stat: "armor", amount: 5, impact: false }),
    );
    expect(combatTexts).toContainEqual(
      expect.objectContaining({ target: "enemy", kind: "damage", stat: "armor", amount: 1, impact: false }),
    );
  });

  it("reports the Armor explicitly stripped by Caustic", () => {
    const state = regressionBattle({
      playerStatuses: { armor: 4 },
      currentEnemy: { traits: [{ id: "caustic", title: "Caustic", description: "" }] },
    });
    const texts: CombatTextEvent[] = [];
    const next = processEncounterTraitActionDamage(state, texts);
    expect(next.playerStatuses.armor).toBe(2);
    expect(texts).toContainEqual(
      expect.objectContaining({ target: "player", kind: "damage", stat: "armor", amount: 1, impact: false }),
    );
  });

  it("shows when Forge arms Everkeen, without repeating an already armed cue", () => {
    const texts: CombatTextEvent[] = [];
    const state = regressionBattle({ gearEffects: { forgeReadiesPhysicalRepeat: 1 } });
    const next = addForgeToPlayer(state, 1, texts);
    expect(next.uniqueGear.everkeenReady).toBe(true);
    const notice = {
      target: "player",
      kind: "notice",
      stat: "playNextCardTwice",
      text: "Everkeen Ready",
      signal: "prepared",
    };
    expect(texts).toContainEqual(notice);
    const again: CombatTextEvent[] = [];
    addForgeToPlayer(next, 1, again);
    expect(again).not.toContainEqual(notice);
  });

  it("shows when a Dodge arms Viper's Courtesy, without repeating an already armed cue", () => {
    const state = regressionBattle({ flags: { dodgeNextAttack: true }, gearEffects: { dodgeReadiesVenomousHit: 1 } });
    const texts: CombatTextEvent[] = [];
    const next = resolveEnemyAttackHit(state, { kind: "damage", damageType: "physical", amount: 2 }, texts, {
      canDodge: true,
    }).state;
    expect(next.uniqueGear.viperReady).toBe(true);
    const notice = {
      target: "player",
      kind: "notice",
      stat: "poison",
      text: "Viper’s Courtesy Ready",
      signal: "prepared",
    };
    expect(texts).toContainEqual(notice);
    const again: CombatTextEvent[] = [];
    resolveEnemyAttackHit(
      { ...next, flags: { ...next.flags, dodgeNextAttack: true } },
      { kind: "damage", damageType: "physical", amount: 2 },
      again,
      { canDodge: true },
    );
    expect(again).not.toContainEqual(notice);
  });
});
