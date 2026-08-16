// @vitest-environment jsdom
import { cleanup, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const playSliceDeath = vi.fn();
const isAnimationDisabled = vi.fn(() => false);

vi.mock("@/lib/audio", () => ({
  playSliceDeath: (...args: unknown[]) => playSliceDeath(...args),
}));

vi.mock("@/lib/animation/animation-prefs", () => ({
  isAnimationDisabled: () => isAnimationDisabled(),
}));

import { SliceDeath } from "@/features/alchemy/shared/ui/battle/slice-death";

describe("SliceDeath", () => {
  beforeEach(() => {
    playSliceDeath.mockReset();
    isAnimationDisabled.mockReturnValue(false);
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it("does not play the slice cue when animation is disabled", () => {
    isAnimationDisabled.mockReturnValue(true);
    render(<SliceDeath imageUrl="/enemy.webp" alt="Goblin" imageClassName="h-full" />);
    expect(playSliceDeath).not.toHaveBeenCalled();
  });

  it("plays the slice cue when the crack animation starts", () => {
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

    render(<SliceDeath imageUrl="/enemy.webp" alt="Goblin" imageClassName="h-full" />);
    expect(playSliceDeath).toHaveBeenCalledOnce();
  });
});
