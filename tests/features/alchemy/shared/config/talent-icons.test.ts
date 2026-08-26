import { describe, expect, it } from "vitest";
import { talentPool } from "@/lib/game-data";
import { TALENT_ICONS } from "@/features/alchemy/shared/config";

describe("talent icon registry", () => {
  it("resolves every authored talent icon id", () => {
    const missing = talentPool
      .filter((talent) => talent.icon)
      .filter((talent) => !(talent.icon && talent.icon in TALENT_ICONS))
      .map((talent) => `${talent.id}:${talent.icon}`);
    expect(missing).toEqual([]);
  });
});
