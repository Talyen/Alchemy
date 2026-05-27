import { describe, expect, it } from "vitest";
import { DEFAULT_TALENT_EFFECTS, createEmptyTalentManifest } from "@/lib/game-data";
import type { TalentEffectManifest } from "@/lib/game-data";

describe("DEFAULT_TALENT_EFFECTS", () => {
  it("covers every TalentEffectManifest field", () => {
    const _typeCheck: TalentEffectManifest = DEFAULT_TALENT_EFFECTS;
    void _typeCheck;

    const defaultKeys = Object.keys(DEFAULT_TALENT_EFFECTS).sort();
    const emptyKeys = Object.keys(createEmptyTalentManifest()).sort();
    expect(defaultKeys).toEqual(emptyKeys);
  });
});
