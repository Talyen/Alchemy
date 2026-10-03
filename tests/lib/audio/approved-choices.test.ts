import { expect, it } from "vitest";
import ledger from "../../../Docs/design/audio-review/approved-choices.json";
import {
  cardSounds,
  enemyAttackSounds,
  battleEventSounds,
  uiSounds,
  stingerSounds,
  screenAmbienceSounds,
} from "@/lib/audio/sound-registry";
import { COMPANION_SOUND_CARD_IDS } from "@/lib/game-constants";

const tables: Record<string, Record<string, string | readonly string[] | null>> = {
  battleEventSounds,
  uiSounds,
  stingerSounds,
  screenAmbienceSounds,
};
const bindings: Record<string, string> = ledger.bindings;

it("installs every approved cue, preserves current choices, and represents selected silence without leaking a shared family cue", () => {
  for (const choice of ledger.choices) {
    const id = choice.mappingId;
    let actual: readonly string[];
    if (id.startsWith("card:")) actual = cardSounds[id.slice(5)] ?? [];
    else if (id.startsWith("enemy:")) actual = enemyAttackSounds[id.slice(6)] ?? [];
    else if (id.startsWith("companion:")) actual = cardSounds[COMPANION_SOUND_CARD_IDS[id.slice(10)]!] ?? [];
    else if (bindings[id]) {
      const [table, key] = bindings[id]!.split(".");
      const sound = tables[table!]?.[key!];
      actual = typeof sound === "string" ? [sound] : (sound ?? []);
    } else {
      // Unchanged silent actions have no new registration or invented behavior.
      expect(choice.runtimeFiles, id).toEqual([]);
      expect(["current", "silence"], id).toContain(choice.choice);
      continue;
    }
    expect(actual, id).toEqual(choice.runtimeFiles);
  }
  expect(screenAmbienceSounds.mystery).toBe(screenAmbienceSounds["labyrinth-map"]);
});
