import { expect, it } from "vitest";
import { ActiveRunDataSchema } from "@/lib/validation";
import { makeMinimalActiveRunInput } from "../../fixtures/active-run";

it("keeps the run and valid destination history when a counter exceeds the integer range", () => {
  const restored = ActiveRunDataSchema.safeParse(
    makeMinimalActiveRunInput({
      destinationRoundsSinceOffered: { Campfire: 3, Mystery: Number.MAX_VALUE },
    }),
  );
  expect(restored.success).toBe(true);
  if (restored.success) expect(restored.data.destinationRoundsSinceOffered).toEqual({ Campfire: 3 });
});
