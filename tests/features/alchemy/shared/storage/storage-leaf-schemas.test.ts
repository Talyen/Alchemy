import { describe, expect, it } from "vitest";
import { DisplayModeSchema, MaterialInventorySchema } from "@/lib/validation";

describe("DisplayModeSchema", () => {
  const parse = (value: unknown) => DisplayModeSchema.catch("borderless-fullscreen").parse(value);

  it.each([
    ["windowed", "windowed"],
    ["borderless-fullscreen", "borderless-fullscreen"],
    ["fullscreen", "fullscreen"],
    [null, "borderless-fullscreen"],
    [undefined, "borderless-fullscreen"],
    ["fake-mode", "borderless-fullscreen"],
    [42, "borderless-fullscreen"],
  ])("parses %s", (input, expected) => {
    expect(parse(input)).toBe(expected);
  });
});

describe("MaterialInventorySchema", () => {
  const emptyInventory = { wood: 0, iron: 0, herbs: 0, food: 0, crystal: 0 };

  it("preserves valid values and fills missing keys", () => {
    expect(MaterialInventorySchema.parse({ wood: 5, iron: 3, herbs: 2, food: 1, crystal: 0 })).toEqual({
      wood: 5,
      iron: 3,
      herbs: 2,
      food: 1,
      crystal: 0,
    });
    expect(MaterialInventorySchema.parse({ wood: 2 })).toEqual({ ...emptyInventory, wood: 2 });
  });

  it.each([null, undefined, "string"])("returns defaults for %s", (input) => {
    expect(MaterialInventorySchema.parse(input)).toEqual(emptyInventory);
  });
});
