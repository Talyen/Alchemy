import { expect, it, vi } from "vitest";
import { companionLibrary, getModifiedCompanionEffects, type CompanionId } from "@/lib/game-data";
import { processCompanionTurnStart } from "@/lib/battle/companion";
import { processEnemyTraits } from "@/lib/battle/enemy-turn-traits";
import { defaultBattleState } from "@/lib/battle";
import { advanceToPlayerTurn } from "@/lib/battle/player-turn-transition";
import { EMPTY_ENEMY_MITIGATION } from "@/lib/battle/enemy-mitigation-state";
import { PER_TURN_UNIQUE_GEAR_RESET } from "@/lib/battle/unique-gear-state";
import { ENEMY_TURN_START_GAINS } from "@/lib/content-systems/enemy-trait-coverage";
import { getNextTierCost, tryUpgradeTierItem } from "@/lib/homestead/upgrades";
import { emptyInventory } from "@/lib/homestead/inventory";
import { createMusicPlayer } from "@/lib/audio/music-player";
import { MUSIC_KEYS } from "@/lib/game-constants";
import { patchBattleState } from "../fixtures/battle";
import { createFakeAudioElement } from "../helpers/fake-audio";

it.each<CompanionId>(["pixie", "wolf"])("modified %s effects cannot rewrite later Companion actions", (id) => {
  const companion = companionLibrary[id];
  const original = structuredClone(companion.turnStartEffects);
  try {
    const effects = getModifiedCompanionEffects(companion, 0, { damageBonus: 0, damageMultiplier: 1 });
    const effect = effects[0]!;
    if (effect.kind === "heal") effect.amount = 99;
    if (effect.kind === "damage") effect.damageTypePool?.splice(0, 2, "holy");
    let rolls = 0;
    const state = patchBattleState({
      activeCompanion: companion,
      playerHealth: 10,
      rng: () => (rolls++ === 0 ? 0.01 : 0.99),
    });
    const next = processCompanionTurnStart(state, []);
    expect(companion.turnStartEffects).toEqual(original);
    if (id === "pixie") expect(next.playerHealth).toBe(11);
    else expect(next.enemyStatuses.bleed).toBe(1);
  } finally {
    companion.turnStartEffects = original;
  }
});

it("editing a Homestead quote cannot change the price charged for its tier", () => {
  const cost = { ...emptyInventory(), wood: 5 };
  const item = { id: "upgrade", tiers: [{ cost }] };
  const quote = getNextTierCost(item, 0)!;
  quote.wood = 0;
  expect(tryUpgradeTierItem(item, 0, emptyInventory())).toMatchObject({ ok: false, nextLevel: 0 });
  const result = tryUpgradeTierItem(item, 0, { ...emptyInventory(), wood: 8 });
  expect(result).toMatchObject({ ok: true, nextLevel: 1, inventory: { wood: 3 } });
  expect(cost.wood).toBe(5);
});

it("enemy trait reward reads cannot rewrite later turn gains", () => {
  const gain = ENEMY_TURN_START_GAINS.get("iron-hide")!;
  const original = { ...gain };
  try {
    Reflect.set(gain, "amount", 99);
    Reflect.set(gain, "everyOtherTurn", false);
    const state = patchBattleState({
      currentEnemy: { traits: [{ id: "iron-hide", title: "", description: "" }] },
      turn: 1,
    });
    expect(processEnemyTraits(state, []).enemyMitigation.armor).toBe(0);
    expect(processEnemyTraits({ ...state, turn: 2 }, []).enemyMitigation.armor).toBe(original.amount);
  } finally {
    for (const [key, value] of Object.entries(original)) Reflect.set(gain, key, value);
  }
});

it("shared combat defaults cannot alter fresh enemies or next-turn opportunities", () => {
  try {
    Reflect.set(EMPTY_ENEMY_MITIGATION, "armor", 99);
    Reflect.set(PER_TURN_UNIQUE_GEAR_RESET, "finalSparkUsed", true);
    expect(defaultBattleState().enemyMitigation).toEqual({ armor: 0, forge: 0, block: 0 });
    const next = advanceToPlayerTurn(patchBattleState({ uniqueGear: { finalSparkUsed: true } }));
    expect(next.uniqueGear.finalSparkUsed).toBe(false);
  } finally {
    Reflect.set(EMPTY_ENEMY_MITIGATION, "armor", 0);
    Reflect.set(PER_TURN_UNIQUE_GEAR_RESET, "finalSparkUsed", false);
  }
});

it.each([false, true])(
  "failed fade cancellation releases sources even if reporting also fails (%s)",
  (reportThrows) => {
    const elements: Array<ReturnType<typeof createFakeAudioElement>> = [];
    const callbacks: Array<() => void> = [];
    let now = 0;
    const reportFailure = vi.fn(() => {
      if (reportThrows) throw new Error("diagnostic failed");
    });
    const player = createMusicPlayer({
      createElement: (file) => {
        const element = createFakeAudioElement(file);
        elements.push(element);
        return element;
      },
      selectFile: (files) => files[0],
      readSettings: () => ({ musicVolume: 1, masterVolume: 1, muted: false }),
      canPlay: () => true,
      now: () => now,
      schedule: (callback) => {
        callbacks.push(callback);
        return callbacks.length as unknown as ReturnType<typeof setInterval>;
      },
      cancel: () => {
        throw new Error("cancel failed");
      },
      reportFailure,
    });
    player.playMusicImmediate(MUSIC_KEYS.MENU);
    player.playMusic(MUSIC_KEYS.BATTLE);
    expect(() => player.reset()).not.toThrow();
    now = 100_000;
    for (const callback of callbacks) callback();
    expect(player.readMusicPlayback()).toBeNull();
    expect(elements).toHaveLength(1);
    expect(elements[0]!.pause).toHaveBeenCalled();
    expect(elements[0]!.removeAttribute).toHaveBeenCalledWith("src");
    expect(reportFailure).toHaveBeenCalledOnce();
  },
);
