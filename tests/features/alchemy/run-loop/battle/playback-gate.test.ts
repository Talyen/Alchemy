import { describe, expect, it } from "vitest";
import { isBattlePlaybackBlocked, isWishPlaybackBlocked } from "@/features/alchemy/run-loop/battle/playback-gate";
import { makeEmptyHandBattle, makeOpenBattle, playableCard } from "./open-battle-fixture";

it.each(["card", "wish"] as const)("blocks %s playback during a play commit or inspection", (mode) => {
  const options = makeOpenBattle();
  if (mode === "wish") options.battleState = { ...options.battleState, wishOptions: [playableCard] };
  const blocked = mode === "wish" ? isWishPlaybackBlocked : isBattlePlaybackBlocked;
  expect(blocked(options)).toBe(false);
  expect(blocked({ ...options, cardPlayInProgress: true })).toBe(true);
  expect(blocked({ ...options, inspectionOpen: true })).toBe(true);
});

describe("isBattlePlaybackBlocked", () => {
  const openBattle = makeOpenBattle();

  it("allows an open player turn", () => {
    expect(isBattlePlaybackBlocked(openBattle)).toBe(false);
  });

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

  it("blocks while a card transfer is in progress", () => {
    expect(isBattlePlaybackBlocked({ ...openBattle, cardTransferInProgress: true })).toBe(true);
  });

  it("blocks when the game menu is open", () => {
    expect(isBattlePlaybackBlocked({ ...openBattle, gameMenuOpen: true })).toBe(true);
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
  const wishedBattle = {
    ...openBattle,
    battleState: { ...openBattle.battleState, wishOptions: [{ ...playableCard, uid: 2 }] },
  };

  it("blocks without wish options", () => {
    expect(isWishPlaybackBlocked(openBattle)).toBe(true);
  });

  it("allows an open player turn with wish options", () => {
    expect(isWishPlaybackBlocked(wishedBattle)).toBe(false);
  });

  it("blocks when the game menu is open", () => {
    expect(isWishPlaybackBlocked({ ...wishedBattle, gameMenuOpen: true })).toBe(true);
  });

  it("blocks while a card transfer is in progress", () => {
    expect(isWishPlaybackBlocked({ ...wishedBattle, cardTransferInProgress: true })).toBe(true);
  });
});
