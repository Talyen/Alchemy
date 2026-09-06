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
      <ArmoryFeedback notice="Item protected." result={null} after={undefined} onDismiss={onDismiss} />,
    );
    expect(screen.getByRole("status").textContent).toBe("Item protected.");
    rerender(<ArmoryFeedback notice="Item unlocked." result={null} after={undefined} onDismiss={onDismiss} />);
    expect(screen.getByRole("status").textContent).toBe("Item unlocked.");
    rerender(<ArmoryFeedback notice="" result={null} after={undefined} onDismiss={onDismiss} />);
    await waitFor(() => expect(screen.queryByText("Item unlocked.")).toBeNull());
  });
});
