import { describe, expect, it } from "vitest";
import { companionLibrary, getCompanionDescriptionLines, getTalentsForKeyword } from "@/lib/game-data";
import { processCompanionTurnStart } from "@/lib/battle/companion";
import { processEnemyDamageEffect } from "@/lib/battle/enemy-attack-damage";
import { resolveEnemyAttackHit } from "@/lib/battle/enemy-attack-hit";
import { applyCardEffects } from "@/lib/battle/effect-handlers";
import { advanceToPlayerTurn } from "@/lib/battle/player-turn-transition";
import type { CombatTextEvent } from "@/lib/battle";
import { selectCombatSound } from "@/features/alchemy/run-loop/battle/combat-sound-selection";
import { makeTestCard, regressionBattle } from "../../fixtures/battle";

describe("player outcomes and rule help", () => {
  it("Counterplate reports its Critical Hit and rejected Stun buildup while preserving the next card's Crit", () => {
    const texts: CombatTextEvent[] = [];
    const state = regressionBattle({
      enemyHealth: 100,
      enemyMaxHealth: 100,
      enemyCC: { cooldown: 2 },
      playerStatuses: { armor: 1 },
      gearEffects: { stunOnArmorLostToAttack: 3 },
      flags: { nextHitCrit: true },
      rng: () => 0,
    });
    const next = resolveEnemyAttackHit(state, { kind: "damage", damageType: "physical", amount: 4 }, texts, {
      canDodge: false,
    }).state;
    expect(next.enemyHealth).toBe(94);
    expect(next.enemyStatuses.stun).toBe(0);
    expect(next.flags.nextHitCrit).toBe(true);
    expect(texts).toContainEqual({ target: "enemy", kind: "damage", stat: "stun", amount: 6, critical: true });
    const notice = texts.find((event) => event.kind === "notice" && event.stat === "stun");
    expect(notice).toMatchObject({ signal: "immune" });
    expect(selectCombatSound(notice ? [notice] : [], false)).toBeUndefined();
    expect(selectCombatSound(texts, false)).toBe("critHit");

    const preventedTexts: CombatTextEvent[] = [];
    const prevented = resolveEnemyAttackHit(
      { ...state, enemyMitigation: { ...state.enemyMitigation, block: 100 } },
      { kind: "damage", damageType: "physical", amount: 4 },
      preventedTexts,
      { canDodge: false },
    ).state;
    expect(prevented.enemyHealth).toBe(100);
    expect(preventedTexts.some((event) => event.kind === "notice" && event.signal === "immune")).toBe(false);
  });

  it("acknowledges Phoenix revival even when the final Health equals the pre-hit Health", () => {
    const texts: CombatTextEvent[] = [];
    const state = regressionBattle({ playerHealth: 30, playerMaxHealth: 100, playerStatuses: { phoenixFeather: 1 } });
    const next = processEnemyDamageEffect(state, { kind: "damage", damageType: "physical", amount: 100 }, texts);
    expect(next.playerHealth).toBe(30);
    expect(next.playerStatuses.phoenixFeather).toBe(0);
    expect(texts).toContainEqual({ target: "player", kind: "notice", stat: "phoenixFeather", text: "Revived" });
    expect(texts).toContainEqual({ target: "player", kind: "heal", stat: "health", amount: 30 });
  });

  it.each(["stun", "freeze"] as const)(
    "explains an immune enemy's rejected %s buildup without a control-success sound",
    (damageType) => {
      const texts: CombatTextEvent[] = [];
      const card = makeTestCard({ effects: [{ kind: "damage", damageType, amount: 3 }] });
      const next = applyCardEffects(
        regressionBattle({ enemyHealth: 100, enemyMaxHealth: 100, enemyCC: { cooldown: 2 } }),
        card,
        texts,
      );
      expect(next.enemyStatuses[damageType]).toBe(0);
      expect(next.enemyCC[damageType === "stun" ? "stunSkipTurns" : "freezeSkipTurns"]).toBe(0);
      const notice = texts.find((event) => event.kind === "notice" && event.stat === damageType);
      expect(notice).toMatchObject({ signal: "immune" });
      expect(selectCombatSound(notice ? [notice] : [], false)).toBeUndefined();
      const preventedTexts: CombatTextEvent[] = [];
      applyCardEffects(
        regressionBattle({
          enemyHealth: 100,
          enemyMaxHealth: 100,
          enemyCC: { cooldown: 2 },
          enemyMitigation: { block: 10 },
        }),
        card,
        preventedTexts,
      );
      expect(preventedTexts.some((event) => event.kind === "notice" && event.signal === "immune")).toBe(false);
    },
  );

  it("Pack Weave describes utility Companion activation, including Pixie healing", () => {
    const state = regressionBattle({
      playerHealth: 20,
      playerMaxHealth: 100,
      activeCompanion: companionLibrary.pixie,
      talentEffects: { companionAttacksOnDodge: true },
      rng: () => 0,
    });
    const next = resolveEnemyAttackHit(state, { kind: "damage", damageType: "physical", amount: 4 }, [], {
      canDodge: true,
    }).state;
    expect(next.playerHealth).toBe(21);
    expect(getTalentsForKeyword("companion").find((talent) => talent.id === "companion-loyal")?.description).toContain(
      "act",
    );
  });

  it("Watchdog explains its enemy-attack condition rather than promising an action on turn decay", () => {
    const state = regressionBattle({
      playerHealth: 20,
      playerMaxHealth: 100,
      enemyHealth: 100,
      enemyMaxHealth: 100,
      activeCompanion: companionLibrary.pixie,
      playerStatuses: { block: 1 },
      talentEffects: { companionAttackOnBlockDepletedBelowHalf: true },
    });
    const decayed = advanceToPlayerTurn(state);
    expect(decayed.playerStatuses.block).toBe(0);
    expect(decayed.playerHealth).toBe(20);
    expect(
      resolveEnemyAttackHit(state, { kind: "damage", damageType: "physical", amount: 1 }, [], { canDodge: true }).state
        .playerHealth,
    ).toBe(21);
    expect(
      getTalentsForKeyword("companion").find((talent) => talent.id === "companion-watchdog")?.description,
    ).toContain("enemy attack");
  });

  it("Mana Moth explains the Mana overflow it grants at full Mana", () => {
    const state = regressionBattle({ mana: 4, maxMana: 4, activeCompanion: companionLibrary["mana-moth"] });
    expect(processCompanionTurnStart(state, []).mana).toBe(5);
    expect(getCompanionDescriptionLines(companionLibrary["mana-moth"], 3)[0]).toContain("allowing overflow");
  });
});
