import { describe, expect, it, vi } from "vitest";
import { createGameSession } from "@/features/alchemy/shared/stores/session/game-session";
import { readGameplayState } from "@/features/alchemy/shared/stores/session/gameplay-state-reads";
import { dispatchGearMutationWithRunHealthSync } from "@/features/alchemy/shared/stores/commands/gear-session-command";
import { getEnemyTraitSet, hasEnemyTrait } from "@/lib/battle/encounter-trait-state";
import { createMusicPlayer } from "@/lib/audio/music-player";
import { MUSIC_KEYS } from "@/lib/game-constants";
import type { GearInstance } from "@/lib/gear";
import { enemyById } from "@/lib/game-data";
import { patchBattleState } from "../fixtures/battle";
import { createFakeAudioElement } from "../helpers/fake-audio";

function musicHarness() {
  const elements: Array<ReturnType<typeof createFakeAudioElement>> = [];
  const reportFailure = vi.fn();
  const player = createMusicPlayer({
    createElement: (file) => {
      const element = createFakeAudioElement(file);
      elements.push(element);
      return element;
    },
    selectFile: (files) => files[0],
    readSettings: () => ({ musicVolume: 1, masterVolume: 1, muted: false }),
    canPlay: () => true,
    now: () => 0,
    schedule: () => {
      throw new Error("Immediate playback needs no fade");
    },
    cancel: () => {},
    reportFailure,
  });
  return { player, elements, reportFailure };
}

describe("failure isolation and borrowed state", () => {
  it("rolls back Gear writes when its callback catches an individual operation failure", async () => {
    await using session = createGameSession();
    const before = readGameplayState(session);
    const instance: GearInstance = { instanceId: "invalid-input", definitionId: "leather-armor-basic", affixes: [] };
    Object.defineProperty(instance, "affixes", { get: () => [] });
    const caught = vi.fn();

    expect(() =>
      dispatchGearMutationWithRunHealthSync(
        {
          mutate: (gear) => {
            gear.addCurrencies({ voidstone: 1 });
            try {
              gear.addInstance(instance, "knight");
            } catch (error) {
              caught(error);
            }
          },
        },
        session,
      ),
    ).toThrow(/Accessors cannot cross/);
    expect(caught).toHaveBeenCalledOnce();
    expect(readGameplayState(session)).toBe(before);
  });

  it("prevents a borrowed trait lookup from changing later combat rules", () => {
    const state = patchBattleState({ currentEnemy: enemyById["fire-elemental"]! });
    const id = state.currentEnemy.traits[0]!.id;
    const lookup = getEnemyTraitSet(state);
    expect(hasEnemyTrait(state, id)).toBe(true);
    try {
      Set.prototype.clear.call(lookup);
    } catch {
      // A readonly facade may reject native Set mutation.
    }
    expect(hasEnemyTrait(state, id)).toBe(true);
    expect(getEnemyTraitSet(state)).toBe(lookup);
    const visited: unknown[] = [];
    lookup.forEach((_value, _key, borrowed) => visited.push(borrowed));
    expect(visited).not.toHaveLength(0);
    expect(visited.every((borrowed) => borrowed === lookup)).toBe(true);
  });

  it("keeps paused music muted after settings sync when the media pause fails", () => {
    const { player, elements } = musicHarness();
    try {
      player.playMusicImmediate(MUSIC_KEYS.MENU);
      const track = elements[0]!;
      track.pause.mockImplementation(() => {
        throw new Error("pause failed");
      });
      player.pauseAllMusic();
      player.syncMusicSettings();
      expect(track.paused).toBe(false);
      expect(track.muted).toBe(true);
      expect(player.readMusicPlayback()?.audible).toBe(false);
    } finally {
      player.reset();
    }
  });

  it("finishes switching music when both media muting and its diagnostic sink throw", () => {
    const { player, elements, reportFailure } = musicHarness();
    try {
      player.playMusicImmediate(MUSIC_KEYS.MENU);
      const outgoing = elements[0]!;
      Object.defineProperty(outgoing, "muted", {
        get: () => false,
        set: () => {
          throw new Error("mute failed");
        },
      });
      reportFailure.mockImplementation(() => {
        throw new Error("diagnostic failed");
      });
      expect(() => player.playMusicImmediate(MUSIC_KEYS.BATTLE)).not.toThrow();
      expect(outgoing.paused).toBe(true);
      expect(elements[1]?.paused).toBe(false);
      expect(player.readMusicPlayback()?.key).toBe(MUSIC_KEYS.BATTLE);
    } finally {
      player.reset();
    }
  });
});
