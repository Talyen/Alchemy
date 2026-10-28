import { act, cleanup, fireEvent, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ATTACK_LUNGE_DURATION_MS, CAST_BRACE_DURATION_MS } from "@/lib/game-constants";
import {
  createCompanionActionPlayback,
  type CompanionPlaybackCue,
} from "@/features/alchemy/run-loop/battle/companion-presentation";
import { CompanionActionMotion } from "@/features/alchemy/run-loop/battle/presentation/ui/companion-action-motion";
import { createCombatFeedback, createCombatFeedbackState } from "@/features/alchemy/run-loop/battle/combat-feedback";

describe("independent Companion action playback", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => {
    cleanup();
    vi.useRealTimers();
    localStorage.removeItem("alchemy-disable-animations");
    vi.unstubAllGlobals();
  });
  it("serializes two identical attack actions instead of batching them into one trigger", () => {
    const seen: Array<CompanionPlaybackCue | null> = [];
    const queue = createCompanionActionPlayback(
      (cue) => seen.push(cue),
      () => true,
    );
    queue.enqueue([
      { companionId: "wolf", kind: "attack" },
      { companionId: "wolf", kind: "attack" },
    ]);
    expect(seen).toMatchObject([{ sequence: 1, kind: "attack" }]);
    vi.advanceTimersByTime(ATTACK_LUNGE_DURATION_MS);
    expect(seen).toMatchObject([{ sequence: 1 }, { sequence: 2 }]);
    vi.advanceTimersByTime(ATTACK_LUNGE_DURATION_MS);
    expect(seen.at(-1)).toBeNull();
    expect(vi.getTimerCount()).toBe(0);
  });
  it("drops replaced/dead Companions and cancels pending beats on teardown", () => {
    const seen = vi.fn();
    let alive = true;
    const queue = createCompanionActionPlayback(seen, () => alive);
    queue.enqueue([
      { companionId: "library-owl", kind: "cast" },
      { companionId: "library-owl", kind: "cast" },
    ]);
    alive = false;
    vi.advanceTimersByTime(CAST_BRACE_DURATION_MS);
    expect(seen).toHaveBeenCalledTimes(2);
    expect(seen).toHaveBeenLastCalledWith(null);
    alive = true;
    queue.enqueue([{ companionId: "wolf", kind: "attack" }]);
    queue.clear();
    expect(vi.getTimerCount()).toBe(0);
  });
  it("handles synchronous teardown while publishing the first action", () => {
    const queue = createCompanionActionPlayback(
      (cue) => {
        if (cue) queue.clear();
      },
      () => true,
    );
    queue.enqueue([
      { companionId: "wolf", kind: "attack" },
      { companionId: "wolf", kind: "attack" },
    ]);
    expect(vi.getTimerCount()).toBe(0);
  });
  it("cancels queued Companion work through the actual feedback owner's lifecycle", () => {
    let state = createCombatFeedbackState();
    const feedback = createCombatFeedback({
      update: (reduce) => {
        state = { ...state, ...reduce(state) };
      },
      isVisible: () => true,
      now: () => Date.now(),
    });
    feedback.actions.enqueueCompanionActions([
      { companionId: "wolf", kind: "attack" },
      { companionId: "wolf", kind: "attack" },
    ]);
    expect(state.companionActionCue?.sequence).toBe(1);
    feedback.cancel();
    state = createCombatFeedbackState();
    vi.advanceTimersByTime(2000);
    expect(state.companionActionCue).toBeNull();
    expect(vi.getTimerCount()).toBe(0);
  });
  it("animates its own frame on mount and each action without remounting content", () => {
    const cue: CompanionPlaybackCue = { companionId: "wolf", kind: "attack", sequence: 1 };
    const { getByTestId, rerender, unmount } = render(
      <CompanionActionMotion cue={cue}>
        <span data-testid="art">Wolf</span>
      </CompanionActionMotion>,
    );
    const art = getByTestId("art");
    const motion = getByTestId("companion-action-motion");
    expect(motion.className).toContain("animate-attack-lunge");
    rerender(
      <CompanionActionMotion cue={{ ...cue, kind: "cast", sequence: 2 }}>
        <span data-testid="art">Wolf</span>
      </CompanionActionMotion>,
    );
    expect(getByTestId("art")).toBe(art);
    expect(motion.className).toContain("animate-cast-brace");
    expect(motion.className).not.toContain("animate-attack-lunge");
    fireEvent.animationEnd(motion, { animationName: "combatant-attack-lunge" });
    expect(motion.className).toContain("animate-cast-brace");
    unmount();
    expect(motion.className).not.toContain("animate-cast-brace");
  });
  it.each(["disabled", "reduced"])("keeps a stationary visible action cue with motion %s", (preference) => {
    if (preference === "disabled") localStorage.setItem("alchemy-disable-animations", "true");
    else
      vi.stubGlobal("matchMedia", () => ({ matches: true, addEventListener: vi.fn(), removeEventListener: vi.fn() }));
    const { getByTestId } = render(
      <CompanionActionMotion cue={{ companionId: "mana-moth", kind: "cast", sequence: 1 }}>Moth</CompanionActionMotion>,
    );
    expect(getByTestId("companion-action-motion").className).toContain("companion-action-highlight");
    expect(getByTestId("companion-action-motion").className).not.toContain("animate-");
    const seen = vi.fn();
    const queue = createCompanionActionPlayback(seen, () => true);
    queue.enqueue([{ companionId: "mana-moth", kind: "cast" }]);
    act(() => vi.advanceTimersByTime(160));
    expect(seen).toHaveBeenLastCalledWith(null);
  });
});
