import "../../../../../helpers/mock-audio";
import { cleanup, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const isAnimationDisabled = vi.fn(() => false);

vi.mock("@/lib/animation/animation-prefs", () => ({
  isAnimationDisabled: () => isAnimationDisabled(),
}));

import { playSliceDeath } from "@/lib/audio";
import { SliceDeath } from "@/features/alchemy/shared/ui/battle/slice-death";

function mockSliceLayout() {
  vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockReturnValue({
    width: 120,
    height: 90,
    top: 0,
    left: 0,
    bottom: 90,
    right: 120,
    x: 0,
    y: 0,
    toJSON: () => ({}),
  });
  const ctx = {
    canvas: { width: 240, height: 180 },
    clearRect: vi.fn(),
    save: vi.fn(),
    restore: vi.fn(),
    beginPath: vi.fn(),
    moveTo: vi.fn(),
    lineTo: vi.fn(),
    stroke: vi.fn(),
    fill: vi.fn(),
    translate: vi.fn(),
    rotate: vi.fn(),
    scale: vi.fn(),
    setLineDash: vi.fn(),
    arc: vi.fn(),
    fillRect: vi.fn(),
    strokeStyle: "",
    fillStyle: "",
    lineWidth: 1,
    lineCap: "round",
    lineJoin: "round",
    globalAlpha: 1,
  };
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(ctx as unknown as CanvasRenderingContext2D);
}

describe("SliceDeath", () => {
  beforeEach(() => {
    vi.mocked(playSliceDeath).mockReset();
    isAnimationDisabled.mockReturnValue(false);
  });

  afterEach(() => {
    cleanup();
  });

  it("does not play the slice cue when animation is disabled", () => {
    isAnimationDisabled.mockReturnValue(true);
    render(<SliceDeath imageUrl="/enemy.webp" alt="Goblin" imageClassName="h-full" />);
    expect(playSliceDeath).not.toHaveBeenCalled();
  });

  it("plays the slice cue when the crack animation starts", () => {
    mockSliceLayout();
    render(<SliceDeath imageUrl="/enemy.webp" alt="Goblin" imageClassName="h-full" />);
    expect(playSliceDeath).toHaveBeenCalledOnce();
  });

  it("keeps the art frame border on each slice half", () => {
    mockSliceLayout();
    const { container } = render(<SliceDeath imageUrl="/enemy.webp" alt="Goblin" imageClassName="h-full" />);
    const halves = container.querySelectorAll("img");
    expect(halves).toHaveLength(2);
    for (const half of halves) {
      expect(half.classList.contains("border")).toBe(true);
      expect(half.classList.contains("border-border/80")).toBe(true);
    }
  });

  it("does not leave a frame border after the slice is skipped", () => {
    isAnimationDisabled.mockReturnValue(true);
    const { container } = render(<SliceDeath imageUrl="/enemy.webp" alt="Goblin" imageClassName="h-full" />);
    expect(container.querySelector("img")).toBeNull();
    expect(container.firstElementChild?.classList.contains("border-border/80")).toBe(false);
  });
});
