import { expect, it } from "vitest";
import { formatContentAuditErrors } from "../../scripts/content-audit.mjs";

it("groups a validation cascade into bounded examples with category totals", () => {
  const errors = Array.from({ length: 2_000 }, (_, index) => ({
    area: index % 2 ? "cards" : "gear",
    id: `entry-${index}`,
    message: "Invalid value",
  }));
  const summary = formatContentAuditErrors(errors);
  expect(summary).toContain("[cards] 1000 error(s)");
  expect(summary).toContain("[gear] 1000 error(s)");
  expect(summary).toContain("entry-0");
  expect(summary).toContain("entry-1");
  expect(summary).not.toContain("entry-1999");
  expect(Buffer.byteLength(summary)).toBeLessThanOrEqual(2_800);
  expect(
    Buffer.byteLength(formatContentAuditErrors([{ area: "cards", id: "huge", message: "診断".repeat(5_000) }])),
  ).toBeLessThanOrEqual(2_800);
});
