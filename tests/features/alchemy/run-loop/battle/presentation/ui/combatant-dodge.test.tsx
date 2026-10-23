import { act, cleanup, render } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";

import { CombatantDodge } from "@/features/alchemy/run-loop/battle/presentation/ui/combatant-dodge";

const originalAnimate = Object.getOwnPropertyDescriptor(Element.prototype, "animate");

function mockAnimation(cancel: () => void) {
  const animate = vi.fn(() => ({ cancel }));
  Object.defineProperty(Element.prototype, "animate", { configurable: true, value: animate });
  return animate;
}

afterEach(() => {
  cleanup();
  localStorage.removeItem("alchemy-disable-animations");
  if (originalAnimate) Object.defineProperty(Element.prototype, "animate", originalAnimate);
  else Reflect.deleteProperty(Element.prototype, "animate");
  vi.restoreAllMocks();
});

it("cancels superseded and dead-frame dodges without replaying an old cue", () => {
  const cancel = vi.fn();
  const animate = mockAnimation(cancel);
  const frame = (token: number, isDead = false) => (
    <CombatantDodge token={token} side="player" isDead={isDead}>
      <div />
    </CombatantDodge>
  );
  const { rerender, unmount } = render(frame(4));
  expect(animate).not.toHaveBeenCalled();
  rerender(frame(5));
  expect(animate).toHaveBeenCalledTimes(1);
  rerender(frame(6));
  expect(cancel).toHaveBeenCalledTimes(1);
  expect(animate).toHaveBeenCalledTimes(2);
  rerender(frame(6, true));
  expect(cancel).toHaveBeenCalledTimes(2);
  rerender(frame(6));
  expect(animate).toHaveBeenCalledTimes(2);
  rerender(frame(0));
  rerender(frame(1));
  expect(animate).toHaveBeenCalledTimes(3);
  unmount();
  expect(cancel).toHaveBeenCalledTimes(3);
});

it("cancels active motion when animations are disabled and consumes skipped cues", () => {
  const cancel = vi.fn();
  const animate = mockAnimation(cancel);
  const frame = (token: number) => (
    <CombatantDodge token={token} side="enemy" isDead={false}>
      <div />
    </CombatantDodge>
  );
  const { rerender } = render(frame(0));
  rerender(frame(1));
  expect(animate).toHaveBeenCalledTimes(1);
  act(() => {
    localStorage.setItem("alchemy-disable-animations", "true");
    window.dispatchEvent(new StorageEvent("storage", { key: "alchemy-disable-animations" }));
  });
  expect(cancel).toHaveBeenCalledTimes(1);
  rerender(frame(2));
  act(() => {
    localStorage.removeItem("alchemy-disable-animations");
    window.dispatchEvent(new StorageEvent("storage", { key: "alchemy-disable-animations" }));
  });
  expect(animate).toHaveBeenCalledTimes(1);
  rerender(frame(3));
  expect(animate).toHaveBeenCalledTimes(2);
});
