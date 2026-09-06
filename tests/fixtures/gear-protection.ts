import { createEmptyGearInventories, createEmptyGearLoadouts } from "@/lib/gear/types";
import { saveEnvelopeFixture } from "./saves";

export function gearProtectionSaveFixture() {
  const gearInventories = createEmptyGearInventories();
  gearInventories.knight = [
    { instanceId: "legacy-sword", definitionId: "longsword-basic", affixes: [] },
    {
      instanceId: "protected-sword",
      definitionId: "longsword-astral",
      affixes: [{ id: "flat-physical", value: 3 }],
      protected: true,
    },
  ];
  const gearLoadouts = createEmptyGearLoadouts();
  gearLoadouts.knight["main-hand"] = "protected-sword";
  return saveEnvelopeFixture({ gearInventories, gearLoadouts });
}
