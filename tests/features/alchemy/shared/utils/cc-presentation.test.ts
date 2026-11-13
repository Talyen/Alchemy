import { describe, expect, it } from "vitest";

import { getActiveCcKeyword, isCcControlled, isStunFreezeBuildupBlocked } from "@/lib/battle";
import { defaultCcState } from "../../../../fixtures/default-battle-state";

describe("cc-presentation", () => {
  it.each([
    [{}, null, false, false],
    [{ cooldown: 2 }, null, false, true],
    [{ stunSkipTurns: 1 }, "stun", true, true],
    [{ freezeSkipTurns: 1 }, "freeze", true, true],
    [{ stunSkipTurns: 1, freezeSkipTurns: 1, cooldown: 2 }, "stun", true, true],
  ] as const)(
    "keeps overlay, active control and buildup immunity consistent for %j",
    (state, keyword, active, blocked) => {
      const cc = defaultCcState(state);
      expect(getActiveCcKeyword(cc)).toBe(keyword);
      expect(isCcControlled(cc)).toBe(active);
      expect(isStunFreezeBuildupBlocked(cc)).toBe(blocked);
    },
  );
});
