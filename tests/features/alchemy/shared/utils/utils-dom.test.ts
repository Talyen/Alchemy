// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  clearTiltFromEvent,
  getBattleCardPlayTarget,
  getCardRect,
  setTiltFromEvent,
} from "@/features/alchemy/shared/utils/dom";
import { makeTestCard } from "../../../../fixtures/cards";

describe("getBattleCardPlayTarget", () => {
  it('returns "enemy" for damage cards', () => {
    const card = makeTestCard({ effects: [{ kind: "damage", damageType: "physical", amount: 5 }] });
    expect(getBattleCardPlayTarget(card)).toBe("enemy");
  });

  it('returns "player" for player-status cards', () => {
    const card = makeTestCard({ effects: [{ kind: "player-status", status: "block", amount: 5 }] });
    expect(getBattleCardPlayTarget(card)).toBe("player");
  });

  it('returns "player" for heal cards', () => {
    const card = makeTestCard({ effects: [{ kind: "heal", amount: 5 }] });
    expect(getBattleCardPlayTarget(card)).toBe("player");
  });

  it('returns "enemy" as default when no matching effect kind is found', () => {
    const card = makeTestCard({ effects: [{ kind: "draw-cards", amount: 1 }] });
    expect(getBattleCardPlayTarget(card)).toBe("enemy");
  });

  it('returns "enemy" for damage even when preceded by other effects', () => {
    const card = makeTestCard({
      effects: [
        { kind: "gain-gold", amount: 5 },
        { kind: "damage", damageType: "physical", amount: 5 },
      ],
    });
    expect(getBattleCardPlayTarget(card)).toBe("enemy");
  });

  it('returns "player" for player-status even when preceded by draw-cards', () => {
    const card = makeTestCard({
      effects: [
        { kind: "draw-cards", amount: 1 },
        { kind: "player-status", status: "block", amount: 5 },
      ],
    });
    expect(getBattleCardPlayTarget(card)).toBe("player");
  });
});

describe("getCardRect", () => {
  it("transforms a DOMRect to a CardRect", () => {
    const rect = {
      x: 10,
      y: 20,
      width: 100,
      height: 150,
      top: 20,
      right: 110,
      bottom: 170,
      left: 10,
      toJSON() {},
    } as DOMRect;
    const cardRect = getCardRect(rect);
    expect(cardRect).toEqual({ x: 10, y: 20, width: 100, height: 150 });
  });
});

describe("tilt geometry", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("refreshes the target rectangle for each animation frame", () => {
    const frames: FrameRequestCallback[] = [];
    vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
      frames.push(callback);
      return frames.length;
    });
    vi.stubGlobal("cancelAnimationFrame", vi.fn());

    const target = document.createElement("div");
    const getBoundingClientRect = vi
      .spyOn(target, "getBoundingClientRect")
      .mockReturnValueOnce(new DOMRect(0, 0, 100, 100))
      .mockReturnValueOnce(new DOMRect(100, 0, 100, 100));

    setTiltFromEvent({ currentTarget: target, clientX: 50, clientY: 50 } as never);
    frames.shift()?.(0);
    expect(target.style.getPropertyValue("--tilt-rotate-y")).toBe("0deg");

    setTiltFromEvent({ currentTarget: target, clientX: 150, clientY: 50 } as never);
    frames.shift()?.(16);
    expect(target.style.getPropertyValue("--tilt-rotate-y")).toBe("0deg");
    expect(getBoundingClientRect).toHaveBeenCalledTimes(2);

    clearTiltFromEvent({ currentTarget: target } as never);
  });
});
