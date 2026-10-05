import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { StatusIcon } from "@/features/alchemy/run-loop/battle/presentation/ui/status-icons";
import { applyEnemyAbility } from "@/lib/battle/enemy-turn-attack";
import { cardById, computeTalentEffects } from "@/lib/game-data";
import { getPlayerStatusChips } from "@/features/alchemy/shared/utils/battle";
import { patchBattleState } from "../../../../../../fixtures/battle";

describe("StatusIcon", () => {
  afterEach(cleanup);

  it("describes the armed Parting Cut as half damage, matching the talent earned on Dodge", async () => {
    const state = patchBattleState({
      talentEffects: computeTalentEffects({ bleed: ["bleed-physical-bonus"] }),
      flags: { dodgeNextAttack: true },
      rng: () => 0.99,
    });
    const dodged = applyEnemyAbility(state, cardById.slash!, []);
    const chip = getPlayerStatusChips(dodged).find((entry) => entry.id === "nextPhysicalDealsBleed")!;
    render(<StatusIcon chip={chip} />);
    fireEvent.focus(screen.getByRole("button", { name: "Parting Cut" }));
    await waitFor(() => {
      expect(document.querySelector(".hover-popup-panel")?.textContent).toContain(
        "Your next Physical card deals half its damage as Bleed damage.",
      );
    });
  });

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

  it("allows keyboard inspection of a counted keyword status", async () => {
    render(<StatusIcon chip={{ id: "thorns", value: 2, hideValue: true }} />);

    fireEvent.focus(screen.getByRole("button", { name: "Thorns 2" }));

    await waitFor(() => {
      const tooltip = document.querySelector<HTMLElement>(".hover-popup-panel[data-visible]");
      expect(tooltip?.textContent).toContain("When hit, Consume Thorns to deal Nature damage");
      expect(tooltip?.textContent).not.toContain("consume");
    });
    expect(screen.getByText("2")).toBeTruthy();
  });

  it("keeps Haste's remaining turns visible when other armed effects hide their values", async () => {
    render(<StatusIcon chip={{ id: "haste", value: 3, hideValue: true }} />);
    fireEvent.focus(screen.getByRole("button", { name: "Haste 3" }));
    await waitFor(() => expect(screen.getByText("3")).toBeTruthy());
    expect(screen.getByText("Skips the next enemy phase and grants another player turn.")).toBeTruthy();
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

  // Badge-less one-shot and keyword-color variants duplicate the Control
  // Immunity, Thorns, and Phoenix Feather cases above.
});
