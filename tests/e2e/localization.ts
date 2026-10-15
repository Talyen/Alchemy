import fs from "node:fs";
import path from "node:path";
import type { Page } from "@playwright/test";
import { unpackCatalogs } from "../../src/lib/localization/catalog-format.mjs";
import packed from "../../src/lib/localization/locales/runtime.json" with { type: "json" };
import { pseudolocalize } from "../../src/lib/localization/pseudolocalize";
import { assertNoOverflow, assertReachableControlsInViewport, waitForLayoutSettled } from "./layout-assertions";

const catalogs = unpackCatalogs(packed);

export const acceptanceLocales = ["de", "zh-Hans", "ru", "es", "pt-BR", "en-XA"] as const;
export type AcceptanceLocale = (typeof acceptanceLocales)[number];
export const layoutReview = process.env.ALCHEMY_LOCALIZATION_LAYOUT_REVIEW === "1";

export function translatedLabel(locale: AcceptanceLocale, english: string): string {
  if (locale === "en-XA") return pseudolocalize(english);
  const id = Object.entries(catalogs.en!).find(([, value]) => value === english)?.[0];
  if (!id) throw new Error(`Unregistered acceptance label: ${english}`);
  return (catalogs[locale] as Record<string, string>)[id]!;
}

export async function reviewLayout(page: Page, name: string) {
  await assertNoOverflow(page, name);
  if (!layoutReview) return;
  await waitForLayoutSettled(page);
  const directory = path.resolve("reports/localization-layout");
  fs.mkdirSync(directory, { recursive: true });
  await page.screenshot({ path: path.join(directory, name.replace(/[^a-z0-9]+/gi, "-") + ".png") });
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
