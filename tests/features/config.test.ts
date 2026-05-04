import { describe, expect, it } from "vitest";
import { getCurrentEnemy } from "@/features/alchemy/config";

describe("getCurrentEnemy", () => {
  it("returns skeleton for room 0", () => {
    expect(getCurrentEnemy(0).id).toBe("skeleton");
  });

  it("returns a non-skeleton enemy for room 1+", () => {
    for (let i = 0; i < 50; i++) {
      const enemy = getCurrentEnemy(1);
      expect(enemy.id).not.toBe("skeleton");
    }
  });

  it("always returns an enemy even with high room count", () => {
    for (let i = 0; i < 50; i++) {
      const enemy = getCurrentEnemy(999);
      expect(enemy).toBeDefined();
      expect(enemy.id).toBeDefined();
    }
  });
});
