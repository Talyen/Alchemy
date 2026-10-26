import fs from "node:fs";
import path from "node:path";
import { expect, type Page } from "@playwright/test";
import { withSavedGame } from "./save-injection";
import { unpackCatalogs } from "../../src/lib/localization/catalog-format.mjs";
import packed from "../../src/lib/localization/locales/runtime.json" with { type: "json" };
import { pseudolocalize } from "../../src/lib/localization/pseudolocalize";
import { assertNoOverflow, assertReachableControlsInViewport, waitForLayoutSettled } from "./layout-assertions";

const catalogs = unpackCatalogs(packed);
const messageIds = new Map<string, string>();
for (const [id, english] of Object.entries(catalogs.en!)) {
  if (!messageIds.has(english)) messageIds.set(english, id);
}

export const acceptanceLocales = ["de", "zh-Hans", "ru", "es", "pt-BR", "ja", "fr", "en-XA"] as const;
export type AcceptanceLocale = (typeof acceptanceLocales)[number];
// One representative language per journey gates pushes. Gameplay settlement
// uses that representative plus expanded-English QA; shared presentation flows
// retain every locale for switching, layout and font coverage.
export function localizationCoverage(locale: AcceptanceLocale, representative: AcceptanceLocale) {
  return {
    tag: [
      "@localization",
      ...(locale === representative ? ["@localization-smoke"] : []),
      ...(locale === "en-XA" ? ["@localization-qa"] : []),
    ],
  };
}

export const layoutReview = process.env.ALCHEMY_LOCALIZATION_LAYOUT_REVIEW === "1";

export function translatedLabel(locale: AcceptanceLocale, english: string): string {
  if (locale === "en-XA") return pseudolocalize(english);
  const id = messageIds.get(english);
  if (!id) throw new Error(`Unregistered acceptance label: ${english}`);
  return (catalogs[locale] as Record<string, string>)[id]!;
}

export async function reviewLayout(page: Page, name: string) {
  await assertNoOverflow(page, name);
  if (!layoutReview) return;
  await waitForLayoutSettled(page);
  if (process.env.ALCHEMY_LOCALIZATION_SCREENSHOTS === "1") {
    const directory = path.resolve("reports/localization-layout");
    fs.mkdirSync(directory, { recursive: true });
    await page.screenshot({ path: path.join(directory, name.replace(/[^a-z0-9]+/gi, "-") + ".png") });
  }
  await assertReachableControlsInViewport(page, name);
}

export function mechanics(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(mechanics);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(
    Object.entries(value)
      .filter(([key]) => !["title", "baseTitle", "description", "descriptionLines", "message", "art"].includes(key))
      .map(([key, item]) => [key, mechanics(item)]),
  );
}

export async function localizedCheckpoint(
  page: Page,
  locale: AcceptanceLocale,
  verify: (fresh: Page) => Promise<void>,
) {
  await expect(page.getByTestId("vr-stage")).toHaveAttribute("data-run-phase", /.+/);
  await page.evaluate((value) => localStorage.setItem("alchemy-language-v1", value), locale);
  await withSavedGame(
    page,
    async (fresh) => {
      await expect(fresh.locator("html")).toHaveAttribute("lang", locale === "en-XA" ? "en" : locale);
      await verify(fresh);
    },
    translatedLabel(locale, "Continue"),
  );
}
