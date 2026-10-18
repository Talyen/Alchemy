import { expect, it } from "vitest";
import { ENCOUNTER_TRAITS } from "@/lib/content-systems/encounter-traits";
import { createCollector } from "@/lib/content-validation/utils";
import { validateEncounterTraits } from "@/lib/content-validation/validators";

it("rejects mismatched battle trait identities and empty mode lists through the authoring gate", () => {
  const trait = ENCOUNTER_TRAITS.tempered;
  const collector = createCollector();
  validateEncounterTraits(collector, {
    tempered: { ...trait, id: "plated", enemyTrait: { ...trait.enemyTrait, id: "plated" }, modes: [] },
  });
  expect(collector.issues).toEqual([
    { severity: "error", area: "encounter-traits", id: "tempered", message: expect.stringMatching(/^modes: /) },
    {
      severity: "error",
      area: "encounter-traits",
      id: "tempered",
      message: "Encounter trait record key does not match id plated",
    },
    {
      severity: "error",
      area: "encounter-traits",
      id: "tempered",
      message: "Encounter trait enemyTrait id does not match definition id",
    },
  ]);
});
