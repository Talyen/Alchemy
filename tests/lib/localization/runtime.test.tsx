import { useGameTranslation } from "@/components/use-game-translation";
import { act, render, screen, fireEvent, cleanup } from "@testing-library/react";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import catalogs from "@/lib/localization/locales/runtime.json";
import { installCatalogs, localization, text, pseudolocalize } from "@/lib/localization/runtime";
import { initializeLanguage, resolveLocale, setLanguagePreference } from "@/lib/localization/language";
import { CardTitle, DescriptionLines } from "@/features/alchemy/shared/ui/cards/card-description-ui";
import { BattleCardSchema } from "@/lib/validation/save-schemas/battle-card-schemas";
import { cardById, cloneBattleCard, renderCardDescription } from "@/lib/game-data";
import { hydrateCard } from "@/lib/game-data/cards/hydrate-card";
import { GearItemTitle } from "@/features/alchemy/shared/ui/gear-item-title";
import { gearDefinitionList } from "@/lib/gear";
import { displayText } from "@/lib/localization/runtime";
import { GameMessage } from "@/components/localization";

beforeAll(() => installCatalogs(catalogs));
afterEach(async () => {
  cleanup();
  await act(async () => {
    await localization.changeLanguage("en");
  });
  vi.unstubAllGlobals();
  localStorage.clear();
});

describe("localized game presentation", () => {
  it("changes language without remounting controls or losing keyboard focus", async () => {
    function Control() {
      useGameTranslation();
      return <button onClick={() => setLanguagePreference("de")}>{text("options.language", "Language")}</button>;
    }
    render(<Control />);
    const button = screen.getByRole("button", { name: "Language" });
    button.focus();
    fireEvent.click(button);
    expect(await screen.findByRole("button", { name: "Sprache" })).toBe(button);
    expect(document.activeElement).toBe(button);
  });

  it("keeps saved effects, magnitude identity and corruption marks when translation reorders a clause", async () => {
    const card = cloneBattleCard(cardById.slash!);
    const part = card.description![0]!.parts.find((part) => typeof part !== "string")!;
    if (typeof part === "string") throw new Error("Expected bound magnitude");
    part.corrupted = true;
    const saved = JSON.parse(JSON.stringify(card));
    const loaded = hydrateCard(BattleCardSchema.parse(saved));
    const before = JSON.stringify(loaded);
    const message = renderCardDescription(loaded.effects, loaded.description!).localizedLines[0]!;
    localization.addResource(
      "de",
      "translation",
      message.id,
      "<keyword0>Physisch</keyword0>: <magnitude0>{{value0}}</magnitude0> Schaden",
    );
    render(
      <>
        <CardTitle card={loaded} />
        <DescriptionLines lines={loaded.descriptionLines} card={loaded} idPrefix="saved" />
      </>,
    );
    await act(async () => {
      await localization.changeLanguage("de");
    });
    expect(screen.getByText("Hieb")).toBeTruthy();
    expect(screen.getByText("4").className).toContain("text-destructive");
    expect(screen.getByText("Physisch")).toBeTruthy();
    expect(JSON.stringify(loaded)).toBe(before);
    const copied = cloneBattleCard(loaded);
    const slot = Object.values(copied.description![0]!.message!.slots).find((slot) => "magnitudeId" in slot)!;
    if ("magnitudeId" in slot) slot.magnitudeId = "other";
    expect(JSON.stringify(loaded)).toBe(before);
    installCatalogs(catalogs);
  });

  it("reorders whole UI sentences while preserving their interactive controls", async () => {
    localization.addResource("de", "translation", "test.reordered", "Weiter mit <action/>.");
    const click = vi.fn();
    render(
      <GameMessage
        id="test.reordered"
        defaultValue="<action/> to continue."
        parts={{ action: <button onClick={click}>OK</button> }}
      />,
    );
    const button = screen.getByRole("button", { name: "OK" });
    button.focus();
    await act(async () => {
      await localization.changeLanguage("de");
    });
    expect(screen.getByRole("button", { name: "OK" })).toBe(button);
    expect(document.activeElement).toBe(button);
    fireEvent.click(screen.getByRole("button", { name: "OK" }));
    expect(click).toHaveBeenCalledOnce();
    expect(screen.getByRole("button", { name: "OK" }).parentElement?.textContent).toContain("Weiter mit OK.");
  });

  it("translates canonical names once even when German wording is another English name", async () => {
    await localization.changeLanguage("de");
    const staff = gearDefinitionList.find((definition) => definition.displayName === "Staff")!;
    render(<GearItemTitle definition={staff} />);
    expect(screen.getByText("Stab")).toBeTruthy();
    expect(screen.queryByText("Stich")).toBeNull();
    const name = displayText("Staff");
    expect(text("test.verbatim-name", "{{name}}", { name })).toBe("Stab");
  });

  it("uses target-language plurals and keeps legacy saved wording playable", async () => {
    await localization.changeLanguage("de");
    expect(text("battle.deaths-door-remaining", "{{count}} protected turns remaining.", { count: 1 })).toBe(
      "Noch 1 geschützter Zug.",
    );
    expect(text("battle.deaths-door-remaining", "{{count}} protected turns remaining.", { count: 3 })).toBe(
      "Noch 3 geschützte Züge.",
    );
    await localization.changeLanguage("en-XA");
    expect(text("deck.inspect", "View Deck · {{count}} cards", { count: 1 })).toBe(
      pseudolocalize("View Deck · {{count}} card").replace("{{count}}", "1"),
    );
    await localization.changeLanguage("de");
    render(<DescriptionLines lines={["Custom saved wording <not-markup>"]} idPrefix="legacy" />);
    expect(screen.getByText(/Custom saved wording/)).toBeTruthy();
  });

  it("does not let late Steam detection override a new explicit preference", async () => {
    let finish: (value: string) => void = () => {};
    vi.stubGlobal("alchemyDesktop", {
      steamGetGameLanguage: () =>
        new Promise<string>((resolve) => {
          finish = resolve;
        }),
    });
    // The bridge reads window.alchemyDesktop, and the test environment aliases globals.
    const pending = initializeLanguage();
    setLanguagePreference("de");
    finish("english");
    await pending;
    expect(localization.language).toBe("de");
    expect(resolveLocale("auto", "schinese", ["de-DE"])).toBe("en");
    expect(resolveLocale("auto", null, ["de-DE"])).toBe("de");
  });
});
