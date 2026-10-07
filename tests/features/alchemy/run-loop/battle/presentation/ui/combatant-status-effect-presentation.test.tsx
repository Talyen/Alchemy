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
