import { readFileSync } from "node:fs";
import { characters } from "@/lib/game-data";
import { describe, expect, it } from "vitest";
import { getRunPhase, isRunLoopScreen, ROUTE_SCREENS } from "@/lib/routing";
import languages from "@/lib/localization/locales/languages.json";
import { getSteamRichPresenceToken } from "@/lib/routing/run-phase-presence";

describe("run-screen-router", () => {
  it("classifies run loop screens", () => {
    expect(isRunLoopScreen(ROUTE_SCREENS.BATTLE)).toBe(true);
    expect(isRunLoopScreen(ROUTE_SCREENS.SHOP)).toBe(true);
    expect(isRunLoopScreen(ROUTE_SCREENS.MENU)).toBe(false);
  });

  it("derives run phase from screen and active battle flag", () => {
    expect(getRunPhase(ROUTE_SCREENS.MENU, false)).toBe("meta");
    expect(getRunPhase(ROUTE_SCREENS.SHOP, false)).toBe("runLoop");
    expect(getRunPhase(ROUTE_SCREENS.BATTLE, true)).toBe("battle");
    expect(getRunPhase(ROUTE_SCREENS.BATTLE, false)).toBe("runLoop");
    expect(getRunPhase(ROUTE_SCREENS.GAME_OVER, false)).toBe("runEnd");
  });
});

it("exports valid localized Steam tokens for every route, outcome and hero", () => {
  const vdf = readFileSync(new URL("../../../steam/rich-presence.vdf", import.meta.url), "utf8");
  expect(vdf.match(/"lang"/g)).toHaveLength(1);
  const sections = [...vdf.matchAll(/^ {2}"([^"]+)"\s*\{\s*"tokens"\s*\{([\s\S]*?)^ {4}\}/gm)];
  expect(sections.map((section) => section[1]).sort()).toEqual(
    Object.values(languages)
      .map((entry) => entry.steam)
      .sort(),
  );
  for (const [, language, body] of sections) {
    const tokens = [...body.matchAll(/^\s*"(#[^"]+)" "(.+)"$/gm)].map((match) => match[1]);
    for (const token of tokens) expect(token).toMatch(/^#[a-zA-Z0-9_]+$/);
    for (const screen of Object.values(ROUTE_SCREENS)) {
      const token = getSteamRichPresenceToken(screen, getRunPhase(screen, screen === ROUTE_SCREENS.BATTLE));
      expect(
        tokens.filter((entry) => entry === token),
        `${language}: ${token}`,
      ).toHaveLength(1);
    }
    for (const hero of Object.keys(characters))
      expect(
        tokens.filter((entry) => entry === `#hero_${hero}`),
        `${language}: ${hero}`,
      ).toHaveLength(1);
    expect(body.match(/\{#hero_%hero%\}/g), language).toHaveLength(1);
  }
});
