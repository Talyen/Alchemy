import { act, cleanup, render } from "@testing-library/react";
import { afterEach, beforeAll, describe, expect, it } from "vitest";
import { REACTION_DEFINITIONS, type CombatTextEvent, type ReactionId } from "@/lib/battle";
import { unpackCatalogs } from "@/lib/localization/catalog-format.mjs";
import bundledCatalogs from "@/lib/localization/locales/runtime.json";
import languages from "@/lib/localization/locales/languages.json";
import { installCatalogs, localization } from "@/lib/localization/runtime";
import { prepareCombatFeedback } from "@/features/alchemy/run-loop/battle/combat-feedback-model";
import { CombatTextRail } from "@/features/alchemy/run-loop/battle/presentation/ui/combat-text";
import { getCombatTextAccessibleLabel } from "@/features/alchemy/shared/utils/battle";
import type { FloatingCombatText } from "@/features/alchemy/shared/types";

const catalogs = unpackCatalogs(bundledCatalogs);
const locales = Object.keys(languages) as Array<keyof typeof languages>;
const reactionIds = Object.keys(REACTION_DEFINITIONS) as ReactionId[];

beforeAll(() => installCatalogs(bundledCatalogs));
afterEach(async () => {
  cleanup();
  await act(async () => {
    await localization.changeLanguage("en");
  });
});

// Read the shipped resource directly so coverage cannot pass via runtime English fallback.
function catalogText(locale: string, english: string): string {
  const key = Object.keys(catalogs.en!).find((id) => catalogs.en![id] === english);
  expect(key, english).toBeDefined();
  const translated = catalogs[locale]![key!];
  expect(translated, `${locale}: ${english}`).toBeTypeOf("string");
  return translated!;
}

const fixedNotices = [
  ["freeze", "Frozen", "Frozen"],
  ["stun", "Stunned", "Stunned"],
  ["dodge", "Dodge", "Dodge"],
  ["phoenixFeather", "Revived", "Revived"],
  ["playNextCardTwice", "Everkeen Ready", "Everkeen Ready"],
  ["poison", "Viper’s Courtesy Ready", "Viper’s Courtesy Ready"],
  ["cleanse", "Nothing to Cleanse", "Nothing to Cleanse"],
  ["deathsDoor", "", "Death's Door"],
  ["companion", "", "Companion"],
  ["wish", "", "Wish"],
  ["scheduled", "", "Scheduled"],
  ["draw", "", "Draw"],
  ["effect", "", "Effect"],
  ["cleanse", "", "Cleanse"],
  ["gems", "", "Gems"],
  ["haste", "", "Haste"],
] as const;

const immunityLabels = {
  en: ["Immune to Stun", "Immune to Freeze"],
  de: ["Immun gegen Betäubung", "Immun gegen Frost"],
  "zh-Hans": ["免疫眩晕", "免疫冻结"],
  ru: ["Иммунитет: Оглушение", "Иммунитет: Заморозка"],
  es: ["Inmune a Aturdimiento", "Inmune a Congelación"],
  "pt-BR": ["Imune a Atordoamento", "Imune a Congelamento"],
  ja: ["気絶無効", "冷気無効"],
  fr: ["Immunité : Étourdissement", "Immunité : Gel"],
} as const satisfies Record<keyof typeof languages, readonly [string, string]>;

function entry(event: CombatTextEvent): FloatingCombatText {
  return { ...event, id: "entry", displayText: "" };
}

describe("localized combat feedback", () => {
  it.each(locales)("covers fixed notices and generated labels in %s", async (locale) => {
    await localization.changeLanguage(locale);
    for (const [stat, text, english] of fixedNotices) {
      expect(
        getCombatTextAccessibleLabel(
          entry({
            target: "player",
            kind: "notice",
            stat,
            text,
            ...(text.endsWith("Ready") ? { signal: "prepared" as const } : {}),
          }),
        ),
      ).toBe(catalogText(locale, english));
    }
    for (const [signal, english] of [
      ["purge", "Purged {{label}}"],
      ["cleanse", "Cleansed {{label}}"],
      ["prepared", "{{label}} prepared"],
    ] as const) {
      const label = catalogText(locale, "Armor");
      expect(
        getCombatTextAccessibleLabel(entry({ target: "player", kind: "notice", stat: "armor", text: "", signal })),
      ).toBe(catalogText(locale, english).replace("{{label}}", label));
    }
    expect(
      getCombatTextAccessibleLabel(
        entry({ target: "player", kind: "notice", stat: "effect", text: "Unrecognized legacy notice" }),
      ),
    ).toBe("Unrecognized legacy notice");
  });

  it.each(locales)("localizes both immunity signals in %s without trusting event wording", async (locale) => {
    await localization.changeLanguage(locale);
    for (const [index, stat] of (["stun", "freeze"] as const).entries()) {
      expect(
        getCombatTextAccessibleLabel(
          entry({
            target: "enemy",
            kind: "notice",
            stat,
            signal: "immune",
            text: "Legacy wording",
          }),
        ),
      ).toBe(immunityLabels[locale][index]);
    }
  });

  it("does not translate a completed accessible label a second time", async () => {
    const previous = localization.getResource("de", "translation", "battle.immune");
    try {
      // A translated result may itself match an English catalog name.
      localization.addResource("de", "translation", "battle.immune", "Shatter");
      await localization.changeLanguage("de");
      const prepared = prepareCombatFeedback(
        [{ target: "enemy", kind: "notice", stat: "stun", signal: "immune", text: "Immune to Stun" }],
        1,
        0,
        1100,
      );
      const { container } = render(<CombatTextRail bursts={prepared.bursts} />);
      expect(container.querySelector('[data-testid="combat-text"]')?.getAttribute("aria-label")).toBe("Shatter");
    } finally {
      localization.addResource("de", "translation", "battle.immune", previous);
    }
  });

  it("preserves signed amounts and critical distinctions in translated numeric labels", async () => {
    await localization.changeLanguage("de");
    const prepared = prepareCombatFeedback(
      [
        { target: "player", kind: "heal", stat: "health", amount: 5 },
        { target: "player", kind: "status", stat: "block", amount: 3 },
        { target: "enemy", kind: "damage", stat: "stun", amount: 22, critical: true, impact: false },
        { target: "enemy", kind: "damage", stat: "stun", amount: 10 },
        { target: "enemy", kind: "damage", stat: "physical", amount: 6, critical: true },
        { target: "enemy", kind: "damage", stat: "physical", amount: 8, additive: false },
      ],
      1,
      40,
      1100,
    );
    const { container } = render(<CombatTextRail bursts={prepared.bursts} />);
    expect(
      [...container.querySelectorAll('[data-testid="combat-text"]')].map((node) => [
        node.textContent,
        node.getAttribute("aria-label"),
      ]),
    ).toEqual([
      ["+5", "Leben: +5"],
      ["+3", "Block: +3"],
      ["-22", "Kritisch Betäubung: -22"],
      ["-10", "Betäubung: -10"],
      ["-14", "Physisch: -14 (enthält einen kritischen Treffer)"],
    ]);
  });

  it("switches every reaction and mounted label in place without changing feedback data", async () => {
    const events: CombatTextEvent[] = [
      ...reactionIds.map(
        (reactionId): CombatTextEvent => ({
          target: "enemy",
          kind: "notice",
          stat: REACTION_DEFINITIONS[reactionId].stat,
          text: REACTION_DEFINITIONS[reactionId].text,
          signal: "reaction",
          reactionId,
        }),
      ),
      { target: "enemy", kind: "notice", stat: "stun", signal: "immune", text: "Immune to Stun" },
      { target: "enemy", kind: "damage", stat: "physical", amount: 5 },
    ];
    const prepared = prepareCombatFeedback(events, 7, 123, 1100);
    const before = JSON.stringify({ events, prepared });
    const { container } = render(<CombatTextRail bursts={prepared.bursts} reactions={prepared.reactions} />);
    const action = container.querySelector('[data-testid="combat-feedback-action"]');
    const burst = container.querySelector('[data-testid="combat-text-burst"]');
    const notice = container.querySelector('[data-kind="notice"]');
    const number = container.querySelector('[data-kind="damage"]');
    const names = [...container.querySelectorAll('[data-testid="reaction-text"]')];
    for (const locale of locales) {
      await act(async () => {
        await localization.changeLanguage(locale);
      });
      expect(container.querySelector('[data-testid="combat-feedback-action"]')).toBe(action);
      expect(container.querySelector('[data-testid="combat-text-burst"]')).toBe(burst);
      expect(burst?.getAttribute("data-burst-id")).toBe("combat-burst-7-enemy");
      expect(burst?.getAttribute("data-first-shown-at")).toBe("123");
      expect(container.querySelector('[data-kind="notice"]')).toBe(notice);
      expect(notice?.getAttribute("aria-label")).toBe(immunityLabels[locale][0]);
      expect(notice?.textContent).toBe("");
      expect(container.querySelector('[data-kind="damage"]')).toBe(number);
      expect(number?.textContent).toBe("-5");
      for (const [index, id] of reactionIds.entries()) {
        const node = container.querySelector(`[data-reaction="${id}"]`);
        expect(node).toBe(names[index]);
        expect(node?.textContent).toBe(catalogText(locale, REACTION_DEFINITIONS[id].text));
      }
      expect(JSON.stringify({ events, prepared })).toBe(before);
    }
  });
});
