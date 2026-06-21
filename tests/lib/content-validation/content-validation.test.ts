import { describe, expect, it } from "vitest";
import { runContentValidation } from "@/lib/content-validation";

describe("content authoring validation", () => {
  it("has no structural content errors", () => {
    const result = runContentValidation();
    const messages = result.errors.map((issue) => `[${issue.area}] ${issue.id}: ${issue.message}`);
    expect(messages).toEqual([]);
  });
});
