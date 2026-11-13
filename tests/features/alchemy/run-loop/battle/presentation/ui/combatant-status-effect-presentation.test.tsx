import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { CombatantStatusEffectPresentation } from "@/features/alchemy/run-loop/battle/presentation/ui/combatant-status-effect-presentation";
import { startCombatantStatusEffectLoop } from "@/lib/animation/combatant-status-effect-loop";
import { shouldReduceMotion } from "@/lib/animation/animation-prefs";

vi.mock("@/lib/animation/combatant-status-effect-loop", () => ({ startCombatantStatusEffectLoop: vi.fn() }));

afterEach(() => {
  cleanup();
  localStorage.clear();
  vi.resetAllMocks();
  vi.unstubAllGlobals();
});

it.each(["OS", "disable flag"])("updates an existing status effect when the %s motion preference changes", (source) => {
  const media = new EventTarget();
  let reduced = true;
  Object.defineProperty(media, "matches", { get: () => source === "OS" && reduced });
  vi.stubGlobal("matchMedia", () => media as MediaQueryList);
  if (source === "disable flag") localStorage.setItem("alchemy-disable-animations", "true");
  const stops: Array<ReturnType<typeof vi.fn>> = [];
  vi.mocked(startCombatantStatusEffectLoop).mockImplementation(({ onFrame }) => {
    onFrame({ progress: 0, wobbleDegrees: shouldReduceMotion() ? 0 : 3 });
    const stop = vi.fn();
    stops.push(stop);
    return stop;
  });
  const view = render(<CombatantStatusEffectPresentation keyword="stun">Portrait</CombatantStatusEffectPresentation>);
  const portrait = screen.getByText("Portrait");
  expect(portrait.style.transform).toBe("");
  const changePreference = (value: boolean) => {
    act(() => {
      reduced = value;
      if (source === "OS") media.dispatchEvent(new Event("change"));
      else {
        localStorage.setItem("alchemy-disable-animations", String(value));
        window.dispatchEvent(new StorageEvent("storage", { key: "alchemy-disable-animations" }));
      }
    });
  };
  changePreference(false);
  expect(portrait.style.transform).toBe("rotate(3deg)");
  expect(stops[0]).toHaveBeenCalledOnce();
  changePreference(true);
  expect(portrait.style.transform).toBe("");
  expect(stops[1]).toHaveBeenCalledOnce();
  view.unmount();
  expect(stops[2]).toHaveBeenCalledOnce();
});

it("stops the control effect on defeat while retaining the mounted portrait and its exact last pose", () => {
  const stop = vi.fn();
  vi.mocked(startCombatantStatusEffectLoop).mockImplementation(({ onFrame }) => {
    onFrame({ progress: 0.6, wobbleDegrees: 2.75 });
    return stop;
  });
  const view = render(<CombatantStatusEffectPresentation keyword="stun">Portrait</CombatantStatusEffectPresentation>);
  const portrait = screen.getByText("Portrait");
  expect(portrait.style.transform).toBe("rotate(2.75deg)");
  view.rerender(
    <CombatantStatusEffectPresentation keyword="stun" defeated>
      Portrait
    </CombatantStatusEffectPresentation>,
  );
  expect(screen.getByText("Portrait")).toBe(portrait);
  expect(portrait.style.transform).toBe("rotate(2.75deg)");
  expect(stop).toHaveBeenCalledOnce();
  expect(screen.queryByTestId("combatant-status-effect-clip")).toBeNull();
  expect(startCombatantStatusEffectLoop).toHaveBeenCalledOnce();
  view.unmount();
  expect(stop).toHaveBeenCalledOnce();
});

it("still clears the transform when control ends on a living portrait, including a replacement after defeat", () => {
  vi.mocked(startCombatantStatusEffectLoop).mockImplementation(({ onFrame }) => {
    onFrame({ progress: 0.6, wobbleDegrees: 2.75 });
    return vi.fn();
  });
  const view = render(<CombatantStatusEffectPresentation keyword="stun">Portrait</CombatantStatusEffectPresentation>);
  const portrait = screen.getByText("Portrait");
  view.rerender(<CombatantStatusEffectPresentation keyword={null}>Portrait</CombatantStatusEffectPresentation>);
  expect(portrait.style.transform).toBe("");
  view.rerender(<CombatantStatusEffectPresentation keyword="stun">Portrait</CombatantStatusEffectPresentation>);
  view.rerender(
    <CombatantStatusEffectPresentation keyword={null} defeated>
      Portrait
    </CombatantStatusEffectPresentation>,
  );
  expect(portrait.style.transform).toBe("rotate(2.75deg)");
  view.rerender(<CombatantStatusEffectPresentation keyword={null}>Portrait</CombatantStatusEffectPresentation>);
  expect(portrait.style.transform).toBe("");
});
