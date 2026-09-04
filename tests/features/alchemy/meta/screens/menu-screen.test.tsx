import { cleanup, render, screen } from "@testing-library/react";
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

describe("MenuScreen logo", () => {
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("applies the shared hover scale to the logo", () => {
    render(<MenuScreen {...defaultProps} />);
    const logo = screen.getByAltText("Alchemy logo");
    expect(logo.getAttribute("src")).toBe("logo-front.png");
    expect(logo.closest(".card-hover-scale")).not.toBeNull();
  });

  it("unlocks talents and homestead independently from finished run characters", () => {
    const { rerender } = render(<MenuScreen {...defaultProps} finishedRunCharacters={[]} />);
    expect(screen.getByRole("button", { name: /talents/i }).getAttribute("aria-disabled")).toBe("true");
    expect(screen.getByRole("button", { name: /homestead/i }).getAttribute("aria-disabled")).toBe("true");

    rerender(<MenuScreen {...defaultProps} finishedRunCharacters={["knight"]} />);
    expect(screen.getByRole("button", { name: /talents/i }).getAttribute("aria-disabled")).toBe("false");
    expect(screen.getByRole("button", { name: /homestead/i }).getAttribute("aria-disabled")).toBe("false");
  });

  it("stacks Play, paired rows, Options, and Quit top to bottom", () => {
    render(<MenuScreen {...defaultProps} onQuit={vi.fn()} />);
    expect(screen.getAllByRole("button").map((button) => button.textContent)).toEqual([
      "Play",
      "Collection",
      "Homestead",
      "Armory",
      "Talents",
      "Options",
      "Quit",
    ]);
  });

  it("pairs Collection with Homestead and Armory with Talents", () => {
    render(<MenuScreen {...defaultProps} />);
    const collectionRow = screen.getByRole("button", { name: /collection/i }).closest(".grid-cols-2");
    expect(collectionRow).not.toBeNull();
    expect(collectionRow).toBe(screen.getByRole("button", { name: /homestead/i }).closest(".grid-cols-2"));

    const armoryRow = screen.getByRole("button", { name: /armory/i }).closest(".grid-cols-2");
    expect(armoryRow).not.toBeNull();
    expect(armoryRow).toBe(screen.getByRole("button", { name: /talents/i }).closest(".grid-cols-2"));

    expect(screen.getByRole("button", { name: "Play" }).closest(".grid-cols-2")).toBeNull();
    expect(screen.getByRole("button", { name: "Options" }).closest(".grid-cols-2")).toBeNull();
  });

  it("colors each navigation icon thematically except Play", () => {
    render(<MenuScreen {...defaultProps} />);

    const iconClass = (label: RegExp) =>
      screen.getByRole("button", { name: label }).querySelector("svg")?.getAttribute("class") ?? "";

    expect(iconClass(/talents/i)).toContain("text-violet-400");
    expect(iconClass(/homestead/i)).toContain("text-emerald-400");
    expect(iconClass(/armory/i)).toContain("text-sky-300");
    expect(iconClass(/collection/i)).toContain("text-amber-300");
    expect(iconClass(/options/i)).toContain("text-zinc-400");
    expect(iconClass(/^play$/i)).not.toContain("text-");
  });

  it("keeps every navigation button at the shared menu size", () => {
    render(<MenuScreen {...defaultProps} />);

    for (const label of ["Play", "Talents", "Homestead", "Armory", "Collection", "Options"]) {
      const button = screen.getByRole("button", { name: new RegExp(label, "i") });
      expect(button.parentElement?.className).toContain("w-[19.2rem]");
      expect(button.className).toContain("h-16");
    }
  });
});
