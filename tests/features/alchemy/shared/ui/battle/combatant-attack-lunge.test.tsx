// @vitest-environment jsdom
import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { CombatantAttackLunge } from "@/features/alchemy/shared/ui/battle/combatant-attack-lunge";

describe("CombatantAttackLunge", () => {
  afterEach(cleanup);

  it("does not animate on a stale positive token at mount", () => {
    const { getByTestId } = render(
      <CombatantAttackLunge attackToken={3} aim={1}>
        <span>art</span>
      </CombatantAttackLunge>,
    );

    expect(getByTestId("combatant-attack-lunge").classList.contains("animate-attack-lunge")).toBe(false);
  });

  it("restarts the lunge when the attack token increases", () => {
    const { getByTestId, rerender } = render(
      <CombatantAttackLunge attackToken={0} aim={1}>
        <span>art</span>
      </CombatantAttackLunge>,
    );

    rerender(
      <CombatantAttackLunge attackToken={1} aim={1}>
        <span>art</span>
      </CombatantAttackLunge>,
    );

    expect(getByTestId("combatant-attack-lunge").classList.contains("animate-attack-lunge")).toBe(true);

    rerender(
      <CombatantAttackLunge attackToken={2} aim={-1}>
        <span>art</span>
      </CombatantAttackLunge>,
    );

    expect(getByTestId("combatant-attack-lunge").classList.contains("animate-attack-lunge")).toBe(true);
    expect(getByTestId("combatant-attack-lunge").style.getPropertyValue("--attack-aim")).toBe("-1");
    expect(getByTestId("combatant-attack-lunge").style.getPropertyValue("--attack-lunge-ms")).toBe("1000ms");
  });
});
