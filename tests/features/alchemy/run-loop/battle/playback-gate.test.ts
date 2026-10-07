import { describe, expect, it } from "vitest";
import { isBattlePlaybackBlocked, isWishPlaybackBlocked } from "@/features/alchemy/run-loop/battle/playback-gate";
import { makeEmptyHandBattle, makeOpenBattle, playableCard } from "./open-battle-fixture";

it.each(["card", "wish"] as const)("blocks %s playback while another interaction owns input", (mode) => {
  const options = makeOpenBattle();
  if (mode === "wish") options.battleState = { ...options.battleState, wishOptions: [playableCard] };
  const blocked = mode === "wish" ? isWishPlaybackBlocked : isBattlePlaybackBlocked;
  expect(blocked(options)).toBe(false);
  for (const [reason, pending] of [
    ["play commit", { cardPlayInProgress: true }],
    ["inspection", { inspectionOpen: true }],
    ["card transfer", { cardTransferInProgress: true }],
    ["game menu", { gameMenuOpen: true }],
  ] as const) {
    expect(blocked({ ...options, ...pending }), reason).toBe(true);
  }
});

describe("isBattlePlaybackBlocked", () => {
  const openBattle = makeOpenBattle();

  it("blocks while a matching hand card is hidden", () => {
    expect(isBattlePlaybackBlocked({ ...openBattle, hiddenHandCardKeys: ["slash-1"] })).toBe(true);
  });

  it("does not block on hidden keys that are not in the current hand", () => {
    expect(
      isBattlePlaybackBlocked({
        ...makeEmptyHandBattle(),
        hiddenHandCardKeys: ["slash-1"],
      }),
    ).toBe(false);
  });

  it("blocks when wish options are showing", () => {
    expect(
      isBattlePlaybackBlocked({
        ...openBattle,
        battleState: { ...openBattle.battleState, wishOptions: [{ ...playableCard, uid: 2 }] },
      }),
    ).toBe(true);
  });
});

describe("isWishPlaybackBlocked", () => {
  const openBattle = makeOpenBattle();

  it("blocks without wish options", () => {
    expect(isWishPlaybackBlocked(openBattle)).toBe(true);
  });
});
