import { describe, expect, it } from "vitest";
import { z } from "zod";
import { cardLibrary, placeholderCard } from "@/lib/game-data";
import { addDuplicateIssues, collectSchemaIssues, createCollector, validateArt } from "@/lib/content-validation/utils";

// Failure paths for the shared validation helpers. The clean catalog never
// exercises these, so they are pinned here with synthetic input.
describe("validation collector", () => {
  it("collects errors and warnings with severity preserved", () => {
    const collector = createCollector();
    collector.error("cards", "card-a", "boom");
    collector.warning("cards", "card-b", "careful");
    expect(collector.issues).toEqual([
      { severity: "error", area: "cards", id: "card-a", message: "boom" },
      { severity: "warning", area: "cards", id: "card-b", message: "careful" },
    ]);
  });
});

describe("addDuplicateIssues", () => {
  it("reports each duplicated value once", () => {
    const collector = createCollector();
    addDuplicateIssues(["a", "b", "a", "c", "b", "a"], "cards", "card id", collector.error);
    expect(collector.issues).toEqual([
      { severity: "error", area: "cards", id: "a", message: "Duplicate card id: a" },
      { severity: "error", area: "cards", id: "b", message: "Duplicate card id: b" },
    ]);
  });

  it("stays silent when values are unique", () => {
    const collector = createCollector();
    addDuplicateIssues(["a", "b", "c"], "cards", "card id", collector.error);
    expect(collector.issues).toEqual([]);
  });
});

describe("collectSchemaIssues", () => {
  it("formats zod failures with their path", () => {
    const collector = createCollector();
    collectSchemaIssues(
      z.object({ id: z.string().min(1), cost: z.number().int().nonnegative() }),
      { id: "", cost: -1 },
      "cards",
      "bad-card",
      collector.error,
    );
    expect(collector.issues).toHaveLength(2);
    expect(collector.issues[0]).toMatchObject({ severity: "error", area: "cards", id: "bad-card" });
    expect(collector.issues[0].message).toContain("id");
    expect(collector.issues[1].message).toContain("cost");
  });

  it("stays silent for valid values", () => {
    const collector = createCollector();
    collectSchemaIssues(z.object({ id: z.string().min(1) }), { id: "ok" }, "cards", "ok", collector.error);
    expect(collector.issues).toEqual([]);
  });
});

describe("validateArt", () => {
  it("accepts known art", () => {
    const collector = createCollector();
    validateArt("cards", cardLibrary[0].id, cardLibrary[0].art, collector.error, collector.warning);
    expect(collector.issues).toEqual([]);
  });

  it("errors on unknown art and warns on placeholder art", () => {
    const collector = createCollector();
    validateArt("cards", "missing-art", "", collector.error, collector.warning);
    validateArt("cards", "unknown-art", "does-not-exist.webp", collector.error, collector.warning);
    validateArt("cards", "placeholder-art", placeholderCard, collector.error, collector.warning);
    const messages = collector.issues.map((issue) => `${issue.severity}:${issue.message}`);
    expect(messages).toContain("error:Missing art reference");
    expect(messages).toContain("error:Art reference is not in the known optimized asset registries");
    expect(messages).toContain("warning:Uses placeholder art");
  });
});
