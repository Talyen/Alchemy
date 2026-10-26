import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it } from "vitest";
import { CombatantAttackLunge } from "@/features/alchemy/run-loop/battle/presentation/ui/combatant-attack-lunge";

afterEach(cleanup);

it("plays fresh attack and cast cues, ignores child completion, and never replays a settled cue", () => {
  const view = (attack: number, cast: number, aim: 1 | -1 = 1) => (
    <CombatantAttackLunge attackToken={attack} castToken={cast} aim={aim}>
      <span>Portrait</span>
    </CombatantAttackLunge>
  );
  const { rerender } = render(view(3, 2));
  const actor = screen.getByTestId("combatant-attack-lunge");
  const active = () => [...actor.classList].filter((name) => name.startsWith("animate-"));
  expect(active()).toEqual([]);
  rerender(view(4, 2));
  expect(active()).toEqual(["animate-attack-lunge"]);
  // JSDOM lacks AnimationEvent, so React listens for the WebKit-prefixed event.
  fireEvent(screen.getByText("Portrait"), new Event("webkitAnimationEnd", { bubbles: true }));
  expect(active()).toEqual(["animate-attack-lunge"]);
  // A new cue replaces unfinished motion instead of layering animations.
  rerender(view(4, 3));
  expect(active()).toEqual(["animate-cast-brace"]);
  rerender(view(5, 3, -1));
  expect(active()).toEqual(["animate-attack-lunge"]);
  expect(actor.style.getPropertyValue("--attack-aim")).toBe("-1");
  fireEvent(actor, new Event("webkitAnimationEnd", { bubbles: true }));
  expect(active()).toEqual([]);
  rerender(view(5, 3));
  expect(active()).toEqual([]);
});
