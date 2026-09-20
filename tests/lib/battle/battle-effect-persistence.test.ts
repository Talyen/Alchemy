import { canPlayCard, playBattleCardResolved } from "@/lib/battle/card-play";
import { endPlayerTurn } from "@/lib/battle/enemy-turn";
import { advanceToPlayerTurn } from "@/lib/battle/player-turn-transition";
import { PersistedBattleStateSchema } from "@/lib/validation/save-schemas/persisted-battle-state";
import { describe, expect, it } from "vitest";
import * as talentBattle from "../../fixtures/talent-battle";
import * as uniqueGearBattle from "../../fixtures/unique-gear-battle";

describe("Talent battle effect persistence", () => {
  const { talents, battle } = talentBattle;

  it("retains pending bonuses and sequencing through save/load, defaulting absent fields", () => {
    const state = battle({
      flags: {
        previousCardWasArchery: true,
        previousCardWasNature: true,
        companionNextAttackBonus: 4,
        sanguinePhysicalBonus: 3,
        darkRecoveryMana: 1,
      },
    });
    const saved = JSON.parse(JSON.stringify(state));
    expect(PersistedBattleStateSchema.parse(saved).flags).toEqual(state.flags);
    for (const key of [
      "previousCardWasArchery",
      "previousCardWasNature",
      "companionNextAttackBonus",
      "sanguinePhysicalBonus",
      "darkRecoveryMana",
    ])
      delete saved.flags[key];
    expect(PersistedBattleStateSchema.parse(saved).flags).toEqual(battle().flags);
  });

  it("Dark Recovery pays once after restoring a pending enemy-phase snapshot", () => {
    const state = battle({
      mana: 0,
      maxMana: 3,
      talentEffects: talents("mana", "mana-arcane-wish", "mana-arcane-mending"),
    });
    const ended = endPlayerTurn(state);
    expect(ended.kind).toBe("standard");
    if (ended.kind === "haste") throw new Error("Expected an enemy phase");
    const loaded = PersistedBattleStateSchema.parse(JSON.parse(JSON.stringify(ended.enemyTurnStartState)));
    const resumed = advanceToPlayerTurn({ ...loaded, rng: () => 0.99 });
    expect(resumed.mana).toBe(4);
    expect(resumed.flags.darkRecoveryMana).toBe(0);
    expect(advanceToPlayerTurn(resumed).mana).toBe(3);
  });
});

describe("Unique Gear battle effect persistence", () => {
  const { battle, attack, play } = uniqueGearBattle;

  it("restoring a used free-card allowance never grants a second free play", () => {
    const card = attack("burn");
    const state = play(battle({ mana: 0, gearEffects: { firstElementalCardsFree: 1 } }), card);
    const restored = PersistedBattleStateSchema.parse(JSON.parse(JSON.stringify(state)));
    const ready = { ...restored, hand: [card], rng: () => 0.99 };
    expect(canPlayCard(ready, card, 0)).toBe(false);
    expect(playBattleCardResolved(ready, card.id, 0).state).toBe(ready);
  });

  it("defaults older saves without changing their captured effects", () => {
    const saved = battle();
    const { uniqueGear: _unique, ...legacy } = saved;
    const restored = PersistedBattleStateSchema.parse(JSON.parse(JSON.stringify(legacy)));
    expect(restored.uniqueGear).toEqual(saved.uniqueGear);
    expect(restored.gearEffects).toEqual(saved.gearEffects);
  });

  it("preserves charges, spent allowances, and delayed arrows through reload", () => {
    const card = attack("physical", { tags: ["archery"] });
    const state = play(
      battle({
        gearEffects: { archeryEchoNextTurn: 1 },
        uniqueGear: { wildheartReady: true, freeBurnUsed: true, spentForge: 3 },
      }),
      card,
    );
    const restored = PersistedBattleStateSchema.parse(JSON.parse(JSON.stringify(state)));
    expect(restored.uniqueGear).toEqual(state.uniqueGear);
    const replayed = advanceToPlayerTurn({ ...restored, rng: () => 0.99 });
    expect(replayed.enemyHealth).toBe(985);
    expect(replayed.uniqueGear.archeryEchoes).toHaveLength(0);
    expect(replayed.uniqueGear.wildheartReady).toBe(true);
  });
});
