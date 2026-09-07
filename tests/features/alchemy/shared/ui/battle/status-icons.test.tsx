import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { StatusIcon } from "@/features/alchemy/shared/ui/battle/status-icons";

describe("StatusIcon", () => {
  afterEach(cleanup);

  it("presents Control Immunity without a numeric badge", async () => {
    render(<StatusIcon chip={{ id: "ccImmunity", value: 2, hideValue: true }} />);

    const trigger = screen.getByRole("button", { name: "Control Immunity" });
    fireEvent.mouseEnter(trigger);

    expect(screen.getByText("Control Immunity")).toBeTruthy();
    await waitFor(() => {
      expect(document.querySelector(".hover-popup-panel[data-visible]")).toBeTruthy();
    });
    expect(screen.queryByText("2")).toBeNull();
  });

  it("styles stack values as neutral chips with keyword-colored numbers", () => {
    render(<StatusIcon chip={{ id: "burn", value: 3 }} />);

    fireEvent.mouseEnter(screen.getByRole("button", { name: "Burn 3" }));

    const valueChip = screen.getByText("3");
    expect(valueChip.className).not.toContain("character-keyword-pill-tint");
    expect(valueChip.className).not.toContain("border-current");
    expect(valueChip.className).toContain("border-border/70");
    expect(valueChip.className).toContain("text-sm");
    expect(valueChip.className).toContain("font-bold");
    expect(valueChip.className).toContain("text-orange-400");
  });

  it("capitalizes keywords in the Thorns status tooltip", async () => {
    render(<StatusIcon chip={{ id: "thorns", value: 2 }} />);

    fireEvent.mouseEnter(screen.getByRole("button", { name: "Thorns 2" }));

    await waitFor(() => {
      const tooltip = document.querySelector<HTMLElement>(".hover-popup-panel[data-visible]");
      expect(tooltip?.textContent).toContain("When hit, Consume Thorns to deal Nature damage");
      expect(tooltip?.textContent).not.toContain("consume");
    });
  });

  it("keeps armed one-shot effects badge-less", () => {
    render(<StatusIcon chip={{ id: "nextHitCrit", value: 1, hideValue: true }} />);

    fireEvent.mouseEnter(screen.getByRole("button", { name: "Predator's Focus" }));

    expect(screen.getByText("Predator's Focus")).toBeTruthy();
    expect(screen.queryByText("1")).toBeNull();
  });
});
