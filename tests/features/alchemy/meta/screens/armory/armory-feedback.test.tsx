import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ArmoryFeedback } from "@/features/alchemy/meta/screens/armory/armory-feedback";
import { installDisabledAnimationsForTests } from "../../../../../helpers/animation-test";

describe("Armory feedback", () => {
  installDisabledAnimationsForTests();
  afterEach(cleanup);
  it("holds a stable message while open and removes it after dismissal", async () => {
    const onDismiss = vi.fn();
    const { rerender } = render(
      <ArmoryFeedback notice="Crafting complete." result={null} after={undefined} onDismiss={onDismiss} />,
    );
    expect(screen.getByRole("status").textContent).toBe("Crafting complete.");
    rerender(<ArmoryFeedback notice="Item salvaged." result={null} after={undefined} onDismiss={onDismiss} />);
    expect(screen.getByRole("status").textContent).toBe("Item salvaged.");
    rerender(<ArmoryFeedback notice="" result={null} after={undefined} onDismiss={onDismiss} />);
    await waitFor(() => expect(screen.queryByText("Item salvaged.")).toBeNull());
  });

  it("retains the combat-locked alert and its color throughout dismissal", () => {
    const onDismiss = vi.fn();
    const { rerender } = render(
      <ArmoryFeedback
        notice="Equipment cannot be changed during Combat."
        result={null}
        after={undefined}
        onDismiss={onDismiss}
        error
      />,
    );
    expect(screen.getByRole("alert").textContent).toBe("Equipment cannot be changed during Combat.");
    const alert = screen.getByRole("alert");
    const color = alert.className;
    const frame = alert.parentElement!.className;
    rerender(<ArmoryFeedback notice="" result={null} after={undefined} onDismiss={onDismiss} />);
    expect(screen.getByRole("alert")).toBe(alert);
    expect(alert.className).toBe(color);
    expect(alert.parentElement!.className.replace("screen-fade-out", "screen-fade-in")).toBe(frame);
  });
});
