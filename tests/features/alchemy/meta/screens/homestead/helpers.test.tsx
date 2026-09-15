import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { HOMESTEAD_CONFIG, getArt, renderTextWithMaterials } from "@/features/alchemy/meta/screens/homestead/helpers";

describe("renderTextWithMaterials", () => {
  it("renders multiple chips in one line and plain text segments", () => {
    const { container } = render(<div>{renderTextWithMaterials("Gain 2 Food and 1 Herbs each run")}</div>);
    expect(screen.getByText("Food")).toBeTruthy();
    expect(screen.getByText("Herbs")).toBeTruthy();
    expect(container.textContent).toContain("Gain");
  });

  it("returns plain text when no material is present", () => {
    const { container } = render(<div>{renderTextWithMaterials("No materials here")}</div>);
    expect(container.textContent).toContain("No materials here");
  });
});

describe("getArt", () => {
  it("returns a string for known ids", () => {
    expect(getArt("blacksmiths-forge")).toBeTruthy();
    expect(typeof getArt("blacksmiths-forge")).toBe("string");
  });

  it("returns fallback empty for unknown id", () => {
    expect(getArt("unknown-id")).toBe("");
  });
});

describe("HOMESTEAD_CONFIG", () => {
  it("has expected pagination constants", () => {
    expect(HOMESTEAD_CONFIG.companionPageSize).toBe(8);
    expect(HOMESTEAD_CONFIG.upgradePageSize).toBe(6);
    expect(HOMESTEAD_CONFIG.hoverScope).toBe("homestead");
  });
});
