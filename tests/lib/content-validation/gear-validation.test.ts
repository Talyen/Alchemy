import { expect, it, vi } from "vitest";
import { createCollector } from "@/lib/content-validation/utils";
import { validateGear } from "@/lib/content-validation/validators-gear";

vi.mock("@/lib/gear", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/gear")>();
  const damaged = {
    ...actual.gearDefinitionList[0]!,
    art: "missing-art.webp",
    salvageValue: { ...actual.gearDefinitionList[0]!.salvageValue, wood: -1 },
  };
  return { ...actual, gearDefinitionList: [damaged, damaged] };
});

it("reports duplicate gear, invalid salvage, and unknown art through the shared content gate", () => {
  const collector = createCollector();
  validateGear(collector);
  const errors = collector.issues.filter((issue) => issue.severity === "error");
  expect(errors).toEqual(
    expect.arrayContaining([
      expect.objectContaining({ area: "gear", message: expect.stringContaining("Duplicate gear definition id") }),
      expect.objectContaining({ area: "gear", message: expect.stringContaining("salvageValue.wood") }),
      expect.objectContaining({
        area: "gear",
        message: "Art reference is not in the known optimized asset registries",
      }),
    ]),
  );
});
