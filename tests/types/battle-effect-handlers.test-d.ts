import { describe, expectTypeOf, it } from "vitest";
import type { BattleCardEffect } from "@/lib/game-data";
import type { EffectHandlers } from "@/lib/battle/effect-handlers/handler-types";
import { EFFECT_APPLY_BY_KIND } from "@/lib/battle/effect-handlers/registry";
import { makeTestCard, patchBattleState } from "../fixtures/battle";

describe("card effect handler contracts", () => {
  it("requires every ordinary effect and leaves recursive effects to orchestration", () => {
    expectTypeOf<keyof typeof EFFECT_APPLY_BY_KIND>().toEqualTypeOf<
      Exclude<BattleCardEffect["kind"], "chance" | "repeat-over-turns">
    >();
  });

  it("rejects mismatched registration and direct calls", () => {
    // @ts-expect-error -- a damage handler cannot be registered for healing
    const heal: EffectHandlers["heal"] = EFFECT_APPLY_BY_KIND.damage;
    void heal;
    // @ts-expect-error -- direct calls must carry the effect named by the table key
    EFFECT_APPLY_BY_KIND.damage(patchBattleState(), makeTestCard(), { kind: "heal", amount: 3 }, 1, []);
  });
});
