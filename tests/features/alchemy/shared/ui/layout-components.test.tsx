import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { ScreenShell, TitledScreenShell } from "@/features/alchemy/shared/ui/layout-components";

describe("ScreenShell", () => {
  it("is a transparent layout container rather than an opaque panel", () => {
    render(<ScreenShell>Content</ScreenShell>);
    const shell = screen.getByText("Content");
    expect(shell.classList.contains("alchemy-shell")).toBe(false);
    expect(shell.className).not.toMatch(/\bbg-/);
    expect(shell.classList.contains("flex")).toBe(true);
    expect(shell.classList.contains("w-full")).toBe(true);
    expect(shell.classList.contains("flex-col")).toBe(true);
  });
});

describe("TitledScreenShell", () => {
  afterEach(() => {
    cleanup();
  });

  it("clips to the stage so plasma can show through the shell", () => {
    const { container } = render(<TitledScreenShell title="Test">Body</TitledScreenShell>);
    expect(container.firstElementChild?.className).toMatch(/\boverflow-hidden\b/);
  });

  it("renders header actions without a hamburger trigger when onMenu is omitted", () => {
    render(
      <TitledScreenShell title="Test" headerActions={<button type="button">Action</button>}>
        Body
      </TitledScreenShell>,
    );
    expect(screen.getByRole("button", { name: "Action" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: /menu/i })).toBeNull();
  });

  it("renders header actions alongside the hamburger trigger when onMenu is provided", () => {
    render(
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
