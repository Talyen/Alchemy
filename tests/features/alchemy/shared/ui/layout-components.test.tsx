// @vitest-environment jsdom
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
    const { container } = render(
      <TitledScreenShell title="Test" onOpenMenu={() => {}} menuLabel="Open test menu">
        Body
      </TitledScreenShell>,
    );
    expect(container.firstElementChild?.className).toMatch(/\boverflow-hidden\b/);
  });
});
