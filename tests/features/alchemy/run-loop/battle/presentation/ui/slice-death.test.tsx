import "../../../../../../helpers/mock-audio";
import { cleanup, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const isAnimationDisabled = vi.fn(() => false);

vi.mock("@/lib/animation/animation-prefs", () => ({
  isAnimationDisabled: () => isAnimationDisabled(),
  shouldReduceMotion: () => isAnimationDisabled(),
  prefersReducedMotion: () => false,
  ANIMATION_DISABLED_DURATION: 1,
}));

import { playSliceDeath } from "@/lib/audio/index";
import { SliceDeath } from "@/features/alchemy/run-loop/battle/presentation/ui/slice-death";

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
    drawImage: vi.fn(),
    strokeStyle: "",
    fillStyle: "",
    lineWidth: 1,
    lineCap: "round",
    lineJoin: "round",
    globalAlpha: 1,
  };
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(ctx as unknown as CanvasRenderingContext2D);
  return ctx;
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
    const { container } = render(<SliceDeath imageUrl="/enemy.webp" alt="Goblin" imageClassName="h-full" />);
    expect(playSliceDeath).not.toHaveBeenCalled();
    expect(container.querySelector("img")).toBeNull();
  });

  it("plays the slice cue when the crack animation starts", () => {
    mockSliceLayout();
    const { container } = render(<SliceDeath imageUrl="/enemy.webp" alt="Goblin" imageClassName="h-full" />);
    expect(playSliceDeath).toHaveBeenCalledOnce();
    expect(container.querySelectorAll("img")).toHaveLength(2);
  });

  it("draws both death halves from the same frozen video pixels before animation, preserving geometry", () => {
    const context = mockSliceLayout();
    const frame = document.createElement("canvas");
    frame.width = 1920;
    frame.height = 1080;
    const { container, getByRole } = render(
      <SliceDeath
        imageUrl="/unused-static.webp"
        frame={frame}
        alt="Countess"
        imageClassName="aspect-video h-portrait object-contain"
      />,
    );
    expect(container.querySelector("img")).toBeNull();
    const halves = [...container.querySelectorAll("canvas")].slice(0, 2);
    expect(halves.map((half) => [half.width, half.height])).toEqual([
      [1920, 1080],
      [1920, 1080],
    ]);
    expect(
      halves.every((half) => half.classList.contains("aspect-video") && half.classList.contains("h-portrait")),
    ).toBe(true);
    expect(halves.every((half) => !half.classList.contains("border"))).toBe(true);
    expect(context.drawImage).toHaveBeenCalledTimes(2);
    expect(context.drawImage).toHaveBeenNthCalledWith(1, frame, 0, 0);
    expect(context.drawImage).toHaveBeenNthCalledWith(2, frame, 0, 0);
    expect(getByRole("img", { name: "Countess" })).toBe(halves[0]);
  });
});
