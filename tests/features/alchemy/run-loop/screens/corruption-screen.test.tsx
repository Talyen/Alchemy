import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { CorruptionScreen } from "@/features/alchemy/run-loop/screens/corruption-screen";
import type { BattleCard } from "@/lib/game-data";
import type { CorruptionResult } from "@/lib/corruption";
import { installDisabledAnimationsForTests } from "../../../../helpers/animation-test";

const testSlash: BattleCard = {
  id: "slash",
  title: "Slash",
  descriptionLines: ["Deal 6 Physical damage"],
  art: "slash",
  cost: 1,
  effects: [{ kind: "damage", damageType: "physical", amount: 6 }],
};

const testStab: BattleCard = {
  id: "stab",
  title: "Stab",
  descriptionLines: ["Deal 4 Physical damage"],
  art: "stab",
  cost: 1,
  effects: [{ kind: "damage", damageType: "physical", amount: 4 }],
};

const testCorruptedCard: BattleCard = {
  ...testSlash,
  descriptionLines: ["Deal 7 Physical damage"],
  effects: [{ kind: "damage", damageType: "physical", amount: 7 }],
  corrupted: true,
};

describe("CorruptionScreen", () => {
  installDisabledAnimationsForTests();

  afterEach(() => {
    cleanup();
  });

  it("renders the intro view with corrupt and leave buttons", async () => {
    const user = userEvent.setup();
    const onExit = vi.fn();
    render(<CorruptionScreen runDeck={[testSlash]} result={null} onCorrupt={vi.fn()} onExit={onExit} />);

    expect(screen.getByRole("heading", { name: "Altar of Corruption" })).toBeTruthy();
    expect(screen.getByRole("button", { name: /Corrupt a Card/i })).toBeTruthy();
    const leaveButton = screen.getByRole("button", { name: /Leave/i });
    expect(leaveButton).toBeTruthy();

    await user.click(leaveButton);
    expect(onExit).toHaveBeenCalledOnce();
  });

  it("navigates from intro to deck picker and allows corrupting a selected card", async () => {
    const user = userEvent.setup();
    const onCorrupt = vi.fn();
    render(<CorruptionScreen runDeck={[testSlash, testStab]} result={null} onCorrupt={onCorrupt} onExit={vi.fn()} />);

    await user.click(screen.getByRole("button", { name: /Corrupt a Card/i }));

    expect(screen.getByText("Select one card. The altar may weaken, strengthen, or remake it.")).toBeTruthy();

    const corruptConfirmBtn = screen.getByRole("button", { name: "Corrupt" });
    expect(corruptConfirmBtn).toHaveProperty("disabled", true);

    const cardButton = screen.getByRole("button", { name: /Select Slash/i });
    await user.click(cardButton);

    expect(corruptConfirmBtn).toHaveProperty("disabled", false);
    await user.click(corruptConfirmBtn);

    expect(onCorrupt).toHaveBeenCalledWith(0);
  });

  it("shows empty message if all cards are already corrupted", async () => {
    const user = userEvent.setup();
    render(<CorruptionScreen runDeck={[testCorruptedCard]} result={null} onCorrupt={vi.fn()} onExit={vi.fn()} />);

    await user.click(screen.getByRole("button", { name: /Corrupt a Card/i }));
    expect(screen.getByText("No uncorrupted cards remain.")).toBeTruthy();
  });

  it("renders result comparison view when a corruption result is present", async () => {
    const user = userEvent.setup();
    const onExit = vi.fn();
    const result: CorruptionResult = {
      originalCard: testSlash,
      corruptedCard: testCorruptedCard,
      transformed: false,
      delta: 1,
    };

    render(<CorruptionScreen runDeck={[testCorruptedCard]} result={result} onCorrupt={vi.fn()} onExit={onExit} />);

    expect(screen.getByText("The altar returns your card changed.")).toBeTruthy();
    expect(screen.getByRole("button", { name: /Original: Slash/i })).toBeTruthy();
    expect(screen.getByRole("button", { name: /Result: Corrupted Slash/i })).toBeTruthy();

    const continueBtn = screen.getByRole("button", { name: /Continue/i });
    await user.click(continueBtn);
    expect(onExit).toHaveBeenCalledOnce();
  });
});
