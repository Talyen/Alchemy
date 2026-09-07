import { beforeAll, describe, expect, it } from "vitest";
import { runContentValidation } from "@/lib/content-validation";

describe("content authoring validation", () => {
  let result: ReturnType<typeof runContentValidation>;

  beforeAll(() => {
    result = runContentValidation();
  });

  it("has no structural content errors", () => {
    const messages = result.errors.map((issue) => `[${issue.area}] ${issue.id}: ${issue.message}`);
    expect(messages).toEqual([]);
  });

  it("has no unexpected content warnings", () => {
    expect(result.warnings).toEqual([]);
  });
});
