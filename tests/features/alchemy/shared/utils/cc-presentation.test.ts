import { describe, expect, it } from "vitest";

import { getActiveCcKeyword, isPlayerCcControlled } from "@/features/alchemy/shared/utils/cc-presentation";
import { defaultCcState } from "../../../../fixtures/default-battle-state";

describe("cc-presentation", () => {
  it("prefers stun for overlay keyword when both skip turns are active", () => {
    const cc = defaultCcState({ stunSkipTurns: 1, freezeSkipTurns: 1 });
    expect(getActiveCcKeyword(cc)).toBe("stun");
  });

  it("returns freeze when only freeze skip turns remain", () => {
    const cc = defaultCcState({ freezeSkipTurns: 1 });
    expect(getActiveCcKeyword(cc)).toBe("freeze");
  });

  it("returns null when no skip turns are active", () => {
    expect(getActiveCcKeyword(defaultCcState())).toBeNull();
  });

  it("detects player CC control from skip turns", () => {
    expect(isPlayerCcControlled(defaultCcState({ stunSkipTurns: 1 }))).toBe(true);
    expect(isPlayerCcControlled(defaultCcState({ cooldown: 2 }))).toBe(false);
  });
});
