import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { installRafStub } from "../../../../helpers/animation-test";
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

  it("tilts the logo toward the pointer", () => {
    const frames = installRafStub();

    render(<MenuScreen {...defaultProps} />);
    const logo = screen.getByRole("button", { name: "Flip Alchemy logo" });
    vi.spyOn(logo, "getBoundingClientRect").mockReturnValue(new DOMRect(0, 0, 100, 100));

    fireEvent.mouseMove(logo, { clientX: 100, clientY: 0 });
    frames.shift()?.(0);

    expect(logo.style.getPropertyValue("--tilt-rotate-y")).toBe("7.5deg");
    expect(logo.style.getPropertyValue("--tilt-rotate-x")).toBe("7.5deg");
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
