import { expect, it } from "vitest";
import { enemyBestiary } from "@/lib/game-data";
import { EnemyContentSchema } from "@/lib/content-validation/schemas";

it("rejects enemies with wrong ability counts or duplicates", () => {
  const base = enemyBestiary[0];
  expect(EnemyContentSchema.safeParse({ ...base, abilityIds: ["a", "b"] }).success).toBe(false);
  expect(
    EnemyContentSchema.safeParse({ ...base, abilityIds: [base.abilityIds[0], base.abilityIds[0], "other"] }).success,
  ).toBe(false);
  expect(EnemyContentSchema.safeParse({ ...base, enemyType: "minion" }).success).toBe(false);
});
