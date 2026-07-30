// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { MenuScreen } from "@/features/alchemy/meta/screens/menu-screen";

const defaultProps = {
  onPlay: vi.fn(),
  onCollection: vi.fn(),
  onOptions: vi.fn(),
  onTalents: vi.fn(),
  onHomestead: vi.fn(),
  onArmory: vi.fn(),
  logoSrc: "logo-front.png",
};

describe("MenuScreen logo variants", () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it("flips without looping when there is only one logo variant", async () => {
    const user = userEvent.setup();
    render(<MenuScreen {...defaultProps} logoSrcVariants={["logo-only.png"]} />);

    await user.click(screen.getByRole("button", { name: "Flip Alchemy logo" }));

    expect(screen.getAllByAltText("Alchemy logo")[1]?.getAttribute("src")).toBe("logo-only.png");
  });

  it("flips to the only back variant when there are two logo variants", async () => {
    const user = userEvent.setup();
    render(<MenuScreen {...defaultProps} logoSrcVariants={["logo-front.png", "logo-back.png"]} />);

    await user.click(screen.getByRole("button", { name: "Flip Alchemy logo" }));

    expect(screen.getAllByAltText("Alchemy logo")[1]?.getAttribute("src")).toBe("logo-back.png");
  });
});
