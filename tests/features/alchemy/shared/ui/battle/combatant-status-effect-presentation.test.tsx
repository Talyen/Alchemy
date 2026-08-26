// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { CombatantStatusEffectPresentation } from "@/features/alchemy/shared/ui/battle/combatant-status-effect-presentation";
import { installDisabledAnimationsForTests } from "../../../../../helpers/animation-test";

describe("CombatantStatusEffectPresentation", () => {
  installDisabledAnimationsForTests();

  afterEach(cleanup);

  it("clips the effect inside the rounded frame border and keeps it in the wobble transform", () => {
    render(
      <CombatantStatusEffectPresentation keyword="stun">
        <div data-testid="portrait">portrait</div>
      </CombatantStatusEffectPresentation>,
    );

    const root = screen.getByTestId("combatant-status-effect");
    const clip = screen.getByTestId("combatant-status-effect-clip");
    const canvas = clip.querySelector("canvas");

    expect(root.classList.contains("rounded-shell-hero")).toBe(true);
    expect(clip.className).toContain("inset-px");
    expect(clip.className).toContain("overflow-hidden");
    expect(clip.className).toContain("rounded-[calc(var(--radius-shell-hero)-1px)]");
    expect(canvas).not.toBeNull();
    expect(screen.getByTestId("portrait").parentElement?.contains(canvas)).toBe(true);
  });

  it("renders children without an effect wrapper when inactive", () => {
    render(
      <CombatantStatusEffectPresentation keyword={null}>
        <div data-testid="portrait">portrait</div>
      </CombatantStatusEffectPresentation>,
    );

    expect(screen.queryByTestId("combatant-status-effect")).toBeNull();
    expect(screen.getByTestId("portrait")).toBeTruthy();
  });
});
