import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

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
  it("clips to the stage so plasma can show through the shell", () => {
    const { container } = render(<TitledScreenShell title="Test">Body</TitledScreenShell>);
    expect(container.firstElementChild?.className).toMatch(/\boverflow-hidden\b/);
  });

  it("renders header actions without a hamburger trigger", () => {
    render(
      <TitledScreenShell title="Test" headerActions={<button type="button">Action</button>}>
        Body
      </TitledScreenShell>,
    );
    expect(screen.getByRole("button", { name: "Action" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: /menu/i })).toBeNull();
  });

  it("renders top right action positioned to the left of the global menu hamburger", () => {
    render(
      <TitledScreenShell title="Test" topRightAction={<button type="button">Top Action</button>}>
        Body
      </TitledScreenShell>,
    );
    const button = screen.getByRole("button", { name: "Top Action" });
    expect(button).toBeTruthy();
    expect(button.parentElement?.className).toContain("absolute top-4 right-18 z-[80]");
  });
});
