import { describe, expect, it } from "vitest";
import { applyCardEffects } from "@/lib/battle";
import { applyDodgeTalentStatuses } from "@/lib/battle/dodge-talent-rewards";
import { prepareTalentCardPlay } from "@/lib/battle/talent-card-play";
import { applyCrowdControlTriggerBonuses } from "@/lib/battle/bonus-effects";
import { processEncounterTraitHealthThreshold } from "@/lib/battle/encounter-trait-health-threshold";
import type { CombatTextEvent } from "@/lib/battle/types";
import { MAX_HAND_SIZE } from "@/lib/game-constants";
import { makeTestCard, regressionBattle } from "../../fixtures/battle";

describe("combat feedback regressions", () => {
  it("acknowledges a capped Mana restoration without inventing a resource gain or damage impact", () => {
    const state = regressionBattle({ mana: 3, maxMana: 3 });
    const texts: CombatTextEvent[] = [];
    const result = applyCardEffects(state, makeTestCard({ effects: [{ kind: "restore-mana", amount: 2 }] }), texts);
    expect(result.mana).toBe(3);
    expect(texts).toEqual([{ target: "player", kind: "status", stat: "mana", amount: 0, impact: false }]);
  });

  it("acknowledges an ineffective attack on the enemy without claiming a hit", () => {
    const state = regressionBattle();
    const texts: CombatTextEvent[] = [];
    const result = applyCardEffects(
      state,
      makeTestCard({ effects: [{ kind: "damage", damageType: "physical", amount: 0 }] }),
      texts,
    );
    expect(result.enemyHealth).toBe(state.enemyHealth);
    expect(texts).toEqual([{ target: "enemy", kind: "damage", stat: "physical", amount: 0, impact: false }]);
  });
  it("Tailwind reports cards actually received, including draws queued behind a full hand", () => {
    const state = regressionBattle({
      hand: Array.from({ length: MAX_HAND_SIZE }, () => makeTestCard()),
      deck: [makeTestCard()],
      talentEffects: { drawOnDodge: 2 },
    });
    const texts: CombatTextEvent[] = [];
    const result = applyDodgeTalentStatuses(state, texts);
    expect(result.pendingHandCards).toHaveLength(1);
    expect(texts).toContainEqual({ target: "player", kind: "status", stat: "draw", amount: 1 });
    const emptyTexts: CombatTextEvent[] = [];
    applyDodgeTalentStatuses({ ...result, deck: [] }, emptyTexts);
    expect(emptyTexts).toEqual([]);
  });

  it("Dodge cleansing distinguishes full cleanses from partial stack removal", () => {
    const state = regressionBattle({
      playerStatuses: { burn: 1, poison: 2, stun: 2 },
      talentEffects: { cleanseStacksOnDodge: 1, cleanseCcOnDodge: true },
    });
    const texts: CombatTextEvent[] = [];
    const result = applyDodgeTalentStatuses(state, texts);
    expect(result.playerStatuses).toMatchObject({ burn: 0, poison: 1, stun: 0 });
    expect(texts).toEqual([
      { target: "player", kind: "notice", stat: "stun", signal: "cleanse", text: "" },
      { target: "player", kind: "notice", stat: "burn", signal: "cleanse", text: "" },
      { target: "player", kind: "damage", stat: "poison", amount: 1, impact: false },
    ]);
  });

  it("Armor Siphon reports the enemy's exact Armor loss independently of the hero's gain bonuses", () => {
    const state = regressionBattle({
      enemyMitigation: { armor: 1 },
      talentEffects: { armorStealOnLeechCard: 2 },
    });
    const texts: CombatTextEvent[] = [];
    const result = prepareTalentCardPlay(state, makeTestCard({ tags: ["leech"] }), texts).state;
    expect(result.enemyMitigation.armor).toBe(0);
    expect(result.playerStatuses.armor).toBe(1);
    expect(texts).toContainEqual({ target: "enemy", kind: "damage", stat: "armor", amount: 1, impact: false });
  });

  it("Icebound and Brittle Armor report the defenses removed, without damage impacts or empty removals", () => {
    const state = regressionBattle({ enemyMitigation: { armor: 3, block: 4 } });
    const texts: CombatTextEvent[] = [];
    const result = applyCrowdControlTriggerBonuses(state, { stripArmor: true, stripBlock: true }, texts);
    expect(result.enemyMitigation).toMatchObject({ armor: 0, block: 0 });
    expect(texts).toEqual([
      { target: "enemy", kind: "damage", stat: "armor", amount: 3, impact: false },
      { target: "enemy", kind: "damage", stat: "block", amount: 4, impact: false },
    ]);
    const emptyTexts: CombatTextEvent[] = [];
    applyCrowdControlTriggerBonuses(result, { stripArmor: true, stripBlock: true }, emptyTexts);
    expect(emptyTexts).toEqual([]);
  });

  it("Divine Aegis activates on a surviving threshold crossing, but not on a lethal hit", () => {
    const state = regressionBattle({
      enemyHealth: 0,
      enemyMaxHealth: 100,
      currentEnemy: { traits: [{ id: "divine-aegis", title: "Divine Aegis", description: "" }] },
    });
    const texts: CombatTextEvent[] = [];
    const result = processEncounterTraitHealthThreshold(60, state, texts);
    expect(result.enemyMitigation).toEqual(state.enemyMitigation);
    expect(result.flags.divineAegisTriggered).toBe(false);
    expect(texts).toEqual([]);
    const surviving = processEncounterTraitHealthThreshold(60, { ...state, enemyHealth: 50 }, []);
    expect(surviving.flags.divineAegisTriggered).toBe(true);
    expect(surviving.enemyMitigation).toMatchObject({ armor: 2, block: 4 });
  });
});
