import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/features/alchemy/run-loop/battle/presentation/ui/hurt-spark-burst", () => ({
  HurtSparkBurst: ({ flashToken, colors }: { flashToken: number; colors: readonly string[] }) => (
    <div data-testid="portrait-impact-sparks" data-token={flashToken} data-colors={colors.join(",")} />
  ),
}));

import { PortraitImpactVfx } from "@/features/alchemy/run-loop/battle/presentation/ui/portrait-hurt-vfx";
import type { CombatImpactCue } from "@/features/alchemy/shared/types";

const makeCue = (overrides: Partial<CombatImpactCue> = {}): CombatImpactCue => ({
  sequence: 1,
  colors: ["#ef4444", "#f87171"],
  healthLost: true,
  amount: 10,
  periodic: false,
  recoil: true,
  ...overrides,
});

describe("PortraitImpactVfx", () => {
  afterEach(cleanup);

  it("renders nothing when pulse is null", () => {
    const { container } = render(<PortraitImpactVfx pulse={null} />);
    expect(container.firstChild).toBeNull();
  });

  it("renders both health-loss flash and spark burst for live damage", () => {
    render(<PortraitImpactVfx pulse={makeCue()} />);

    expect(screen.getByTestId("portrait-health-loss-flash")).toBeTruthy();
    const sparks = screen.getByTestId("portrait-impact-sparks");
    expect(sparks.getAttribute("data-token")).toBe("1");
    expect(sparks.getAttribute("data-colors")).toBe("#ef4444,#f87171");
  });

  it("suppresses the health-loss flash when isDead is true", () => {
    render(<PortraitImpactVfx pulse={makeCue()} isDead />);

    expect(screen.queryByTestId("portrait-health-loss-flash")).toBeNull();
    expect(screen.getByTestId("portrait-impact-sparks")).toBeTruthy();
  });

  it("suppresses the health-loss flash when healthLost is false", () => {
    render(<PortraitImpactVfx pulse={makeCue({ healthLost: false })} />);

    expect(screen.queryByTestId("portrait-health-loss-flash")).toBeNull();
    expect(screen.getByTestId("portrait-impact-sparks")).toBeTruthy();
  });

  it("respects explicit showHealthFlash override when provided", () => {
    const { rerender } = render(<PortraitImpactVfx pulse={makeCue()} isDead showHealthFlash={true} />);
    expect(screen.getByTestId("portrait-health-loss-flash")).toBeTruthy();

    rerender(<PortraitImpactVfx pulse={makeCue()} isDead={false} showHealthFlash={false} />);
    expect(screen.queryByTestId("portrait-health-loss-flash")).toBeNull();
  });

  it("updates spark token when pulse sequence advances", () => {
    const { rerender } = render(<PortraitImpactVfx pulse={makeCue({ sequence: 1 })} />);
    expect(screen.getByTestId("portrait-impact-sparks").getAttribute("data-token")).toBe("1");

    rerender(<PortraitImpactVfx pulse={makeCue({ sequence: 2 })} />);
    expect(screen.getByTestId("portrait-impact-sparks").getAttribute("data-token")).toBe("2");
  });
});
