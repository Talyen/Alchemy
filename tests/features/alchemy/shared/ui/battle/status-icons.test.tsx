// @vitest-environment jsdom
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { StatusIcon } from "@/features/alchemy/shared/ui/battle/status-icons";

describe("StatusIcon", () => {
  it("presents Control Immunity without a numeric badge", () => {
    render(<StatusIcon chip={{ id: "ccImmunity", value: 2, hideValue: true }} />);

    const trigger = screen.getByRole("button", { name: "Control Immunity" });
    fireEvent.mouseEnter(trigger);

    expect(screen.getByText("Control Immunity")).toBeTruthy();
    expect(screen.queryByText("2")).toBeNull();
  });

  it("styles stack values as larger keyword-colored tinted chips", () => {
    render(<StatusIcon chip={{ id: "burn", value: 3 }} />);

    fireEvent.mouseEnter(screen.getByRole("button", { name: "Burn 3" }));

    const valueChip = screen.getByText("3");
    expect(valueChip.className).toContain("character-keyword-pill-tint");
    expect(valueChip.className).toContain("border-current");
    expect(valueChip.className).toContain("text-sm");
    expect(valueChip.className).toContain("font-bold");
    expect(valueChip.className).toContain("text-orange-400");
  });

  it("keeps armed one-shot effects badge-less", () => {
    render(<StatusIcon chip={{ id: "nextHitCrit", value: 1, hideValue: true }} />);

    fireEvent.mouseEnter(screen.getByRole("button", { name: "Predator's Focus" }));

    expect(screen.getByText("Predator's Focus")).toBeTruthy();
    expect(screen.queryByText("1")).toBeNull();
  });
});
