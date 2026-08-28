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

  it("triggers lunge animation when attackToken increases", () => {
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
    expect(getByTestId("combatant-attack-lunge").style.getPropertyValue("--attack-aim")).toBe("1");
    expect(getByTestId("combatant-attack-lunge").style.getPropertyValue("--attack-lunge-ms")).toBe("950ms");

    rerender(
      <CombatantAttackLunge attackToken={2} aim={-1}>
        <span>art</span>
      </CombatantAttackLunge>,
    );

    expect(getByTestId("combatant-attack-lunge").classList.contains("animate-attack-lunge")).toBe(true);
    expect(getByTestId("combatant-attack-lunge").style.getPropertyValue("--attack-aim")).toBe("-1");
  });

  it("triggers brace cast animation when castToken increases", () => {
    const { getByTestId, rerender } = render(
      <CombatantAttackLunge attackToken={0} castToken={0} aim={1}>
        <span>art</span>
      </CombatantAttackLunge>,
    );

    rerender(
      <CombatantAttackLunge attackToken={0} castToken={1} aim={1}>
        <span>art</span>
      </CombatantAttackLunge>,
    );
    expect(getByTestId("combatant-attack-lunge").classList.contains("animate-cast-brace")).toBe(true);
    expect(getByTestId("combatant-attack-lunge").style.getPropertyValue("--cast-brace-ms")).toBe("520ms");
  });

  it("applies custom className", () => {
    const { getByTestId } = render(
      <CombatantAttackLunge attackToken={0} aim={1} className="test-column-class">
        <span>art</span>
      </CombatantAttackLunge>,
    );

    expect(getByTestId("combatant-attack-lunge").classList.contains("test-column-class")).toBe(true);
  });
});
