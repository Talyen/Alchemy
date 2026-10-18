import { describe, expect, it } from "vitest";
import { z } from "zod";
import { placeholderCard } from "@/lib/game-data";
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
  it("reports duplicates, schema failures, and bad art as errors and placeholder art as a warning", () => {
    const collector = createCollector();
    validateLibraryBasics(collector, {
      ...options,
      items: [
        { id: "duplicate", title: "Duplicate", art: "", cost: -1 },
        { id: "duplicate", title: "Duplicate", art: "unknown.webp", cost: 1 },
        { id: "placeholder", title: "Placeholder", art: placeholderCard, cost: 1 },
      ],
    });
    const errors = collector.issues.filter((issue) => issue.severity === "error");
    const warnings = collector.issues.filter((issue) => issue.severity === "warning");
    // Duplicate id, duplicate title, schema failure, missing art, unknown art.
    expect(errors).toHaveLength(5);
    // The duplicate title is attributed to the title text itself.
    expect(errors.filter((issue) => issue.id === "Duplicate")).toHaveLength(1);
    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toMatchObject({ area: "cards", id: "placeholder" });
  });
});
