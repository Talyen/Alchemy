import { describe, expect, it } from "vitest";
import { z } from "zod";
import { cardLibrary, placeholderCard } from "@/lib/game-data";
import { createCollector, validateLibraryBasics } from "@/lib/content-validation/utils";

const schema = z.object({ id: z.string().min(1), title: z.string(), art: z.string(), cost: z.number().nonnegative() });
const options = {
  area: "cards" as const,
  schema,
  titleOf: (item: { title: string }) => item.title,
  artOf: (item: { art: string }) => item.art,
  idLabel: "card id",
};

describe("library authoring validation", () => {
  it("reports duplicate IDs and titles, schema failures, missing/unknown art and placeholder warnings through the shared owner", () => {
    const collector = createCollector();
    validateLibraryBasics(collector, {
      ...options,
      items: [
        { id: "duplicate", title: "Duplicate", art: "", cost: -1 },
        { id: "duplicate", title: "Duplicate", art: "unknown.webp", cost: 1 },
        { id: "placeholder", title: "Placeholder", art: placeholderCard, cost: 1 },
      ],
    });
    expect(collector.issues).toEqual([
      { severity: "error", area: "cards", id: "duplicate", message: "Duplicate card id: duplicate" },
      { severity: "error", area: "cards", id: "Duplicate", message: "Duplicate title: Duplicate" },
      { severity: "error", area: "cards", id: "duplicate", message: expect.stringMatching(/^cost: /) },
      { severity: "error", area: "cards", id: "duplicate", message: "Missing art reference" },
      {
        severity: "error",
        area: "cards",
        id: "duplicate",
        message: "Art reference is not in the known optimized asset registries",
      },
      { severity: "warning", area: "cards", id: "placeholder", message: "Uses placeholder art" },
    ]);
  });

  it("accepts valid catalog entries without diagnostics", () => {
    const collector = createCollector();
    validateLibraryBasics(collector, { ...options, items: cardLibrary });
    expect(collector.issues).toEqual([]);
  });
});
