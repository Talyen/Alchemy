import { describe, expect, it } from "vitest";
import { CURRENT_SAVE_SCHEMA_VERSION, LAUNCH_SAVE_SCHEMA_VERSION } from "@/lib/validation";
import { createDefaultSaveData, defaultSaveData } from "@/features/alchemy/shared/storage/defaults";

describe("save baseline and defaults", () => {
  it("keeps the unfrozen development baseline at the current schema", () => {
    expect(LAUNCH_SAVE_SCHEMA_VERSION).toBe(CURRENT_SAVE_SCHEMA_VERSION);
  });

  it("isolates default progress between independent loads", () => {
    const first = createDefaultSaveData();
    const second = createDefaultSaveData();
    first.discoveredCardIds.push("slash");
    first.gearLoadouts.knight.body = "other-session-item";
    first.materialInventory.wood = 99;
    expect(second).toEqual(defaultSaveData);
    expect(createDefaultSaveData()).toEqual(defaultSaveData);
  });
});
