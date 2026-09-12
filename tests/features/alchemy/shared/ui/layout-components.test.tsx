import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { TitledScreenShell } from "@/features/alchemy/shared/ui/layout-components";

describe("TitledScreenShell", () => {
  afterEach(() => {
    cleanup();
  });

  it("renders header actions with or without the hamburger trigger", () => {
    const { rerender } = render(
      <TitledScreenShell title="Test" headerActions={<button type="button">Action</button>}>
        Body
      </TitledScreenShell>,
    );
    expect(screen.getByRole("button", { name: "Action" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: /menu/i })).toBeNull();

    rerender(
      <TitledScreenShell title="Test" headerActions={<button type="button">Action</button>} onMenu={() => {}}>
        Body
      </TitledScreenShell>,
    );
    expect(screen.getByRole("button", { name: "Action" })).toBeTruthy();
    expect(screen.getByRole("button", { name: /menu/i })).toBeTruthy();
  });

  it("renders a back button on the left when onBack is provided", () => {
    let backClicked = false;
    render(
      <TitledScreenShell
        title="Test"
        onBack={() => {
          backClicked = true;
        }}
      >
        Body
      </TitledScreenShell>,
    );
    const backButton = screen.getByRole("button", { name: "Back" });
    expect(backButton).toBeTruthy();
    backButton.click();
    expect(backClicked).toBe(true);
  });
});
