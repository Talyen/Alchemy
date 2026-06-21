import { describe, expect, it } from "vitest";
import { runContentValidation } from "@/lib/content-validation";
import type { ContentValidationArea } from "@/lib/content-validation";

const ALL_AREAS: ContentValidationArea[] = [
  "art",
  "balance",
  "cards",
  "companions",
  "encounter-traits",
  "enemies",
  "gear",
  "keywords",
  "rewards",
  "statuses",
  "trinkets",
];

describe("content authoring validation", () => {
  it("has no structural content errors", () => {
    const result = runContentValidation();
    const messages = result.errors.map((issue) => `[${issue.area}] ${issue.id}: ${issue.message}`);
    expect(messages).toEqual([]);
  });

  it("has no unexpected content warnings", () => {
    const result = runContentValidation();
    for (const area of ALL_AREAS) {
      const areaWarnings = result.warnings.filter((w) => w.area === area);
      expect(areaWarnings, `${area} warnings`).toEqual([]);
    }
  });
});
