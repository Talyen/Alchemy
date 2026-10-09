import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, it } from "vitest";
import { ManaPanel } from "@/features/alchemy/run-loop/battle/presentation/ui/resources";

afterEach(cleanup);

it("keeps unchanged mana artwork mounted through spending, gains, and rejected attempts", () => {
  const { rerender } = render(<ManaPanel mana={3} maxMana={4} />);
  const crystals = () => Array.from(screen.getByTestId("mana-panel").querySelectorAll("img"));
  const initial = crystals();
  rerender(<ManaPanel mana={2} maxMana={4} />);
  const spent = crystals();
  expect(spent[0]).toBe(initial[0]);
  expect(spent[1]).toBe(initial[1]);
  expect(spent[2]).not.toBe(initial[2]);
  expect(spent[2]!.classList.contains("mana-gem-spent")).toBe(true);
  expect(spent[3]).toBe(initial[3]);

  rerender(<ManaPanel mana={3} maxMana={4} />);
  const gained = crystals();
  expect(gained[0]).toBe(initial[0]);
  expect(gained[2]).not.toBe(spent[2]);
  expect(gained[2]!.classList.contains("mana-gem-active")).toBe(true);
  expect(gained[3]).toBe(initial[3]);

  rerender(<ManaPanel mana={3} maxMana={4} rejected />);
  expect(crystals()).toEqual(gained);
  expect(screen.getByRole("img", { name: "Mana: 3 / 4" }).classList.contains("mana-play-rejected")).toBe(true);
});
