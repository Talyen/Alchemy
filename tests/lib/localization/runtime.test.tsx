import { useGameTranslation } from "@/components/use-game-translation";
import { act, render, screen, fireEvent, cleanup, within } from "@testing-library/react";
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
import { DemoCompletionScreen } from "@/features/alchemy/run-loop/screens/demo-completion-screen";
import languages from "@/lib/localization/locales/languages.json";
import { CurrencyAmount, GoldDisplay } from "@/features/alchemy/shared/ui/display-elements";
import { ResourcePill } from "@/features/alchemy/shared/ui/material-icons";
import { HomesteadWallet } from "@/features/alchemy/meta/screens/homestead/resource-wallet";

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
  it("refreshes every resource display in place when the game language changes", async () => {
    const gold = 123456.7;
    const inventory = Object.freeze({ wood: 12, stone: 0, iron: 0, food: 0, herbs: 0, hide: 0, gems: 0 });
    render(
      <>
        <div data-testid="currency">
          <CurrencyAmount amount={gold} />
        </div>
        <GoldDisplay gold={gold} />
        <div data-testid="pill">
          <ResourcePill resource="gold" amount={gold} showsIncreasePrefix />
        </div>
        <div data-testid="wallet">
          <HomesteadWallet gold={gold} inventory={inventory} />
        </div>
      </>,
    );
    const currency = screen.getByTestId("currency");
    const display = screen.getByTestId("run-gold");
    const pill = screen.getByTestId("pill");
    const wallet = screen.getByTestId("wallet");
    for (const [locale, expected] of [
      ["en", "123.5K"],
      ["de", "123.456,7"],
      ["zh-Hans", "12.3万"],
      ["ru", "123,5\u00a0тыс."],
      ["es", "123,5\u00a0mil"],
      ["pt-BR", "123,5\u00a0mil"],
      ["en-XA", "123.5K"],
    ] as const) {
      await act(async () => {
        await localization.changeLanguage(locale);
      });
      for (const container of [currency, display, wallet])
        expect(within(container).getByText(expected, { exact: true, normalizer: (value) => value })).toBeTruthy();
      expect(within(pill).getByTitle(`+${expected}`, { normalizer: (value) => value })).toHaveProperty(
        "textContent",
        `+${expected}`,
      );
      expect(screen.getByTestId("run-gold")).toBe(display);
    }
    expect(inventory.wood).toBe(12);
  });

  it("switches promo artwork in place for every shipped language and keeps the focused action", async () => {
    const onMainMenu = vi.fn();
    render(<DemoCompletionScreen onMainMenu={onMainMenu} />);
    const image = screen.getByTestId("demo-marketing-image");
    const original = image.getAttribute("src");
    const englishAlt = image.getAttribute("alt");
    const button = screen.getByRole("button", { name: "Main Menu" });
    button.focus();
    expect(document.activeElement).toBe(button);
    const images = new Set([original]);
    for (const locale of Object.keys(languages).filter((locale) => locale !== "en")) {
      await act(async () => {
        await localization.changeLanguage(locale);
      });
      expect(screen.getByTestId("demo-marketing-image")).toBe(image);
      expect(image.getAttribute("src")).toMatch(`demo-feature-showcase-${locale.toLowerCase()}.webp`);
      expect(image.getAttribute("alt")).not.toContain("More Bosses");
      expect(document.activeElement).toBe(button);
      images.add(image.getAttribute("src"));
    }
    expect(images.size).toBe(Object.keys(languages).length);
    await act(async () => {
      await localization.changeLanguage("en-XA");
    });
    expect(image.getAttribute("src")).toBe(original);
    expect(image.getAttribute("alt")).not.toBe(englishAlt);
    fireEvent.click(button);
    expect(onMainMenu).toHaveBeenCalledOnce();
  });

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
    for (const [locale, counts] of [
      ["zh-Hans", ["查看牌组 · 1张牌", "查看牌组 · 2张牌", "查看牌组 · 5张牌"]],
      ["ru", ["Просмотр колоды · 1 карта", "Просмотр колоды · 2 карты", "Просмотр колоды · 5 карт"]],
      ["es", ["Ver mazo · 1 carta", "Ver mazo · 2 cartas", "Ver mazo · 5 cartas"]],
      ["pt-BR", ["Ver baralho · 1 carta", "Ver baralho · 2 cartas", "Ver baralho · 5 cartas"]],
    ] as const) {
      await localization.changeLanguage(locale);
      for (const [index, count] of [1, 2, 5].entries())
        expect(text("deck.inspect", "View Deck · {{count}} cards", { count })).toBe(counts[index]);
    }
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
    expect(resolveLocale("auto", "schinese", ["de-DE"])).toBe("zh-Hans");
    for (const [steam, locale] of [
      ["russian", "ru"],
      ["spanish", "es"],
      ["brazilian", "pt-BR"],
    ])
      expect(resolveLocale("auto", steam!, ["en-US"])).toBe(locale);
    for (const [system, locale] of [
      ["zh-CN", "zh-Hans"],
      ["zh-SG", "zh-Hans"],
      ["ru-RU", "ru"],
      ["es-ES", "es"],
      ["pt-BR", "pt-BR"],
    ])
      expect(resolveLocale("auto", null, [system!])).toBe(locale);
    for (const steam of ["tchinese", "latam", "portuguese", "constructor", "__proto__"])
      expect(resolveLocale("auto", steam, ["de-DE"])).toBe("en");
    expect(resolveLocale("auto", null, ["de-DE"])).toBe("de");
  });
});
