import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { ManaPanel } from "@/features/alchemy/run-loop/battle/presentation/ui/mana-dock";
import { PilePanel } from "@/features/alchemy/run-loop/battle/presentation/ui/resources";
import { battlePresentation } from "@/app/battle-presentation";
import { playUISound } from "@/lib/audio";
import { makeTestCard } from "../../../../../../fixtures/battle";

const motion = vi.hoisted(() => ({ reduced: false }));
vi.mock("@/components/ui/use-reduced-motion-preference", () => ({
  useReducedMotionPreference: () => motion.reduced,
}));
vi.mock("@/lib/audio", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/audio")>()),
  playUISound: vi.fn(),
}));

const animateDescriptor = Object.getOwnPropertyDescriptor(Element.prototype, "animate");
const cancel = vi.fn();
const animate = vi.fn(function (this: Element) {
  return { cancel } as unknown as Animation;
});
beforeEach(() => {
  motion.reduced = false;
  vi.clearAllMocks();
  Object.defineProperty(Element.prototype, "animate", { configurable: true, value: animate });
});

afterEach(() => {
  cleanup();
  battlePresentation.getState().resetPresentation();
  if (animateDescriptor) Object.defineProperty(Element.prototype, "animate", animateDescriptor);
  else Reflect.deleteProperty(Element.prototype, "animate");
});

it("keeps unchanged crystals mounted through spending, refill, and capacity gain", () => {
  const { rerender } = render(<ManaPanel mana={3} maxMana={4} presentation={battlePresentation} />);
  const gem = (index: number) => screen.getByTestId("mana-panel").querySelector(`[data-mana-index="${index}"]`)!;
  const firstArt = gem(0).querySelector(".mana-dock-full");
  const unchangedToken = gem(0).getAttribute("data-effect-token");
  rerender(<ManaPanel mana={2} maxMana={4} presentation={battlePresentation} />);
  expect(gem(0).querySelector(".mana-dock-full")).toBe(firstArt);
  expect(gem(0).getAttribute("data-effect-token")).toBe(unchangedToken);
  expect(gem(2).getAttribute("data-effect")).toBe("spend");
  const spentArt = gem(2).querySelector(".mana-dock-empty");
  const spentToken = gem(2).getAttribute("data-effect-token");
  const nextSpentArt = gem(1).querySelector(".mana-dock-full");
  rerender(<ManaPanel mana={1} maxMana={4} presentation={battlePresentation} />);
  expect(gem(2).getAttribute("data-filled")).toBe("false");
  expect(gem(2).querySelector(".mana-dock-empty")).toBe(spentArt);
  expect(gem(2).getAttribute("data-effect-token")).toBe(spentToken);
  expect(gem(1).getAttribute("data-effect")).toBe("spend");
  expect(gem(1).querySelector(".mana-dock-full")).not.toBe(nextSpentArt);
  expect(gem(0).querySelector(".mana-dock-full")).toBe(firstArt);
  rerender(<ManaPanel mana={3} maxMana={4} presentation={battlePresentation} />);
  expect(gem(2).getAttribute("data-effect")).toBe("fill");
  const refilledArt = gem(2).querySelector(".mana-dock-full");
  rerender(<ManaPanel mana={4} maxMana={5} presentation={battlePresentation} />);
  expect(gem(4).getAttribute("data-effect")).toBe("gain");
  expect(gem(2).querySelector(".mana-dock-full")).toBe(refilledArt);
  expect(gem(0).querySelector(".mana-dock-full")).toBe(firstArt);
});

it("caps visible gems with a badge and keeps exact values accessible without a readout", () => {
  render(<ManaPanel mana={14} maxMana={17} presentation={battlePresentation} />);
  expect(screen.getByTestId("mana-panel").querySelectorAll("[data-mana-index]")).toHaveLength(9);
  expect(screen.getByText("+8")).toBeDefined();
  expect(screen.getByRole("img", { name: "Mana: 14 / 17" })).toBeDefined();
  expect(screen.queryByText("14 / 17")).toBeNull();
});

it("signals newly queued instances without replaying restored or retained cards", () => {
  const first = makeTestCard({ id: "block", uid: 1 });
  const second = makeTestCard({ id: "block", uid: 2 });
  const props = { label: "Draw Pile", count: 3, type: "draw" as const };
  const view = render(<PilePanel {...props} overflowCards={[first]} />);
  view.rerender(<PilePanel {...props} overflowCards={[{ ...first }]} />);
  expect(playUISound).not.toHaveBeenCalled();
  expect(animate).not.toHaveBeenCalled();
  view.rerender(<PilePanel {...props} overflowCards={[first, second]} />);
  expect(playUISound).toHaveBeenCalledExactlyOnceWith("error");
  expect(animate).toHaveBeenCalledOnce();
  expect(animate.mock.contexts[0]).toBe(screen.getByTestId("draw-pile").querySelector("img"));
  view.rerender(<PilePanel {...props} overflowCards={[second]} />);
  expect(playUISound).toHaveBeenCalledTimes(1);
  view.rerender(<PilePanel {...props} overflowCards={[{ ...second, uid: 3 }]} />);
  expect(playUISound).toHaveBeenCalledTimes(2);
  expect(animate).toHaveBeenCalledTimes(2);
  view.unmount();
  expect(cancel).toHaveBeenCalledTimes(2);
});

it("acknowledges opening overflow and keeps its sound when motion is disabled", () => {
  const props = { label: "Draw Pile", count: 0, type: "draw" as const };
  const cards = [makeTestCard({ uid: 4 })];
  const view = render(<PilePanel {...props} openingDrawPending overflowCards={cards} />);
  expect(playUISound).toHaveBeenCalledExactlyOnceWith("error");
  expect(animate).toHaveBeenCalledOnce();
  view.unmount();
  motion.reduced = true;
  vi.clearAllMocks();
  render(<PilePanel {...props} openingDrawPending overflowCards={cards} />);
  expect(playUISound).toHaveBeenCalledExactlyOnceWith("error");
  expect(animate).not.toHaveBeenCalled();
});
