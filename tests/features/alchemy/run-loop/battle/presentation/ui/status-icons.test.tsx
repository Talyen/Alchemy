import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { StatusIcon } from "@/features/alchemy/run-loop/battle/presentation/ui/status-icons";
import { keywordDefinitions } from "@/lib/game-data/index";

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

  it("capitalizes keywords in the Thorns status tooltip", async () => {
    render(<StatusIcon chip={{ id: "thorns", value: 2 }} />);

    fireEvent.mouseEnter(screen.getByRole("button", { name: "Thorns 2" }));

    await waitFor(() => {
      const tooltip = document.querySelector<HTMLElement>(".hover-popup-panel[data-visible]");
      expect(tooltip?.textContent).toContain("When hit, Consume Thorns to deal Nature damage");
      expect(tooltip?.textContent).not.toContain("consume");
    });
  });

  it("presents Phoenix Feather as a status without a numeric badge", async () => {
    render(<StatusIcon chip={{ id: "phoenixFeather", value: 1, hideValue: true }} />);

    fireEvent.mouseEnter(screen.getByRole("button", { name: "Phoenix Feather" }));

    await waitFor(() => {
      const tooltip = document.querySelector<HTMLElement>(".hover-popup-panel[data-visible]");
      expect(tooltip?.textContent).toContain("The next time you would die, instead restore 30% Health");
    });
    expect(screen.queryByText("1")).toBeNull();
  });

  it("keeps armed one-shot effects badge-less", () => {
    render(<StatusIcon chip={{ id: "nextHitCrit", value: 1, hideValue: true }} />);

    fireEvent.mouseEnter(screen.getByRole("button", { name: "Predator's Focus" }));

    expect(screen.getByText("Predator's Focus")).toBeTruthy();
    expect(screen.queryByText("1")).toBeNull();
  });

  it("colors the Poison keyword in the Poison Dagger status tooltip", async () => {
    render(<StatusIcon chip={{ id: "nextHitPoison", value: 1, hideValue: true }} />);

    fireEvent.mouseEnter(screen.getByRole("button", { name: "Poison Dagger" }));

    await waitFor(() => {
      expect(document.querySelector(".hover-popup-panel[data-visible]")).toBeTruthy();
    });
    const tooltip = document.querySelector<HTMLElement>(".hover-popup-panel[data-visible]");
    expect(tooltip?.textContent).toContain("Your next attack is converted to Poison damage.");
    expect(screen.getByText("Poison").className).toContain(keywordDefinitions.poison.colorClass);
  });

  it("colors Stun and Freeze in the Control Immunity status tooltip", async () => {
    render(<StatusIcon chip={{ id: "ccImmunity", value: 2, hideValue: true }} />);

    fireEvent.mouseEnter(screen.getByRole("button", { name: "Control Immunity" }));

    await waitFor(() => {
      expect(document.querySelector(".hover-popup-panel[data-visible]")).toBeTruthy();
    });
    expect(screen.getByText("Stun").className).toContain(keywordDefinitions.stun.colorClass);
    expect(screen.getByText("Freeze").className).toContain(keywordDefinitions.freeze.colorClass);
  });
});
