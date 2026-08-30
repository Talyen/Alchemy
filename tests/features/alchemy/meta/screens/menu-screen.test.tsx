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
  finishedRunCharacters: [],
};

describe("MenuScreen logo variants", () => {
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("applies the shared hover scale to the logo", () => {
    render(<MenuScreen {...defaultProps} />);
    const logo = screen.getByRole("button", { name: "Flip Alchemy logo" });
    expect(logo.classList.contains("card-hover-scale")).toBe(true);
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

  it("unlocks talents and homestead independently from finished run characters", () => {
    const { rerender } = render(<MenuScreen {...defaultProps} finishedRunCharacters={[]} />);
    expect(screen.getByRole("button", { name: /talents/i }).getAttribute("aria-disabled")).toBe("true");
    expect(screen.getByRole("button", { name: /homestead/i }).getAttribute("aria-disabled")).toBe("true");

    rerender(<MenuScreen {...defaultProps} finishedRunCharacters={["knight"]} />);
    expect(screen.getByRole("button", { name: /talents/i }).getAttribute("aria-disabled")).toBe("false");
    expect(screen.getByRole("button", { name: /homestead/i }).getAttribute("aria-disabled")).toBe("false");
  });

  it("keeps every navigation button at the shared menu width", () => {
    render(<MenuScreen {...defaultProps} />);

    for (const label of ["Play", "Talents", "Homestead", "Armory", "Collection", "Options"]) {
      const button = screen.getByRole("button", { name: new RegExp(label, "i") });
      expect(button.parentElement?.className).toContain("w-[19.2rem]");
    }
  });
});
