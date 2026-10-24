import { act, cleanup, fireEvent, render } from "@testing-library/react";
import { labyrinthShroudedArt, mysteryBg } from "@/features/alchemy/shared/config/game-data-catalog";
import { afterEach, expect, it, vi } from "vitest";
import { floorNodes } from "@/lib/content-systems/labyrinth/map-state";
import { LabyrinthMapViewport } from "@/features/alchemy/run-loop/screens/labyrinth/labyrinth-map-viewport";
import { gridLabyrinthMapFixture } from "../../../../../fixtures/labyrinth-map";

import { installFocusInputForTests } from "../../../../../helpers/focus-input-test";

installFocusInputForTests(true);

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

function renderViewport() {
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {}
      disconnect() {}
    },
  );
  vi.spyOn(window, "getComputedStyle").mockReturnValue({ width: "800px", height: "600px" } as CSSStyleDeclaration);
  const map = gridLabyrinthMapFixture();
  const props = {
    map,
    heroArt: "/knight.webp",
    nodes: floorNodes(map, map.currentFloor),
    onSelect: vi.fn(),
  };
  const view = render(<LabyrinthMapViewport {...props} />);
  return {
    ...props,
    rerender: () => {
      const nextMap = structuredClone(props.map);
      view.rerender(
        <LabyrinthMapViewport {...props} map={nextMap} nodes={floorNodes(nextMap, nextMap.currentFloor)} />,
      );
    },
  };
}

it("shows encounter details on hover and keyboard focus, without inspecting the hero or hidden rooms", () => {
  const props = renderViewport();
  const room = document.querySelector<HTMLElement>('[data-labyrinth-node="labyrinth-floor-1-n0"] button')!;
  fireEvent.mouseEnter(room);
  expect(document.querySelector('[role="tooltip"]')?.textContent).toContain("Goblin");
  expect(props.onSelect).not.toHaveBeenCalled();
  fireEvent.mouseLeave(room);
  cleanup();
  renderViewport();
  const hero = document.querySelector<HTMLElement>('[aria-current="location"]')!;
  fireEvent.mouseEnter(hero);
  expect(document.querySelector('[role="tooltip"]')).toBeNull();
  const hidden = document.querySelector<HTMLElement>('[data-state="undiscovered"] button')!;
  fireEvent.mouseEnter(hidden);
  expect(document.querySelector('[role="tooltip"]')).toBeNull();
  fireEvent.keyDown(document.body, { key: "Tab" });
  const boss = document.querySelector<HTMLElement>(".labyrinth-boss")!;
  act(() => boss.focus());
  expect(document.querySelector('[role="tooltip"]')?.textContent).toContain("The Forge Golem");
});

it("keeps varied fog independent of hidden encounters and replaces it upon discovery", () => {
  const props = renderViewport();
  const hidden = Array.from(document.querySelectorAll<HTMLElement>('[data-labyrinth-node][data-state="undiscovered"]'));
  // Returning from a destination remounts the map with rooms already reachable.
  const reachable = document.querySelector('[data-labyrinth-node][data-state="reachable"]')!;
  expect(reachable.querySelector(".labyrinth-discovery")!.getAttribute("data-crossfade")).toBe("true");
  expect(reachable.querySelector(".labyrinth-discovery-fog")).not.toBeNull();
  expect(document.querySelector('[data-current="true"] .labyrinth-discovery-fog')).toBeNull();
  expect(document.querySelector(".labyrinth-boss .labyrinth-discovery-fog")).toBeNull();
  const sources = hidden.map((tile) => tile.querySelector("img")!.getAttribute("src"));
  expect(new Set(sources).size).toBeGreaterThan(1);
  for (const source of sources) expect(labyrinthShroudedArt).toContain(source);
  const tile = hidden[0]!;
  const node = props.map.nodes[tile.dataset.labyrinthNode!]!;
  const button = tile.querySelector("button")!;
  const label = button.getAttribute("aria-label");
  fireEvent.click(button);
  expect(props.onSelect).not.toHaveBeenCalled();
  expect(button.getAttribute("aria-disabled")).toBe("true");

  node.type = "mystery";
  delete node.enemyId;
  props.rerender();
  expect(tile.querySelector("img")!.getAttribute("src")).toBe(sources[0]);
  expect(button.getAttribute("aria-label")).toBe(label);
  expect(tile.querySelector(".labyrinth-discovery-fog")).toBeNull();

  // Clearing an adjacent room reveals the encounter without changing its identity.
  const neighbor = props.nodes.find(
    (candidate) =>
      Math.abs(candidate.gridPosition.row - node.gridPosition.row) +
        Math.abs(candidate.gridPosition.col - node.gridPosition.col) ===
      1,
  )!;
  neighbor.cleared = true;
  props.rerender();
  expect(tile.querySelector("img")!.getAttribute("src")).toBe(mysteryBg);
  const incoming = tile.querySelector(".labyrinth-discovery")!;
  expect(incoming.getAttribute("data-crossfade")).toBe("true");
  const fog = tile.querySelector(".labyrinth-discovery-fog")!;
  expect(fog.getAttribute("src")).toBe(sources[0]);
  expect(fog.getAttribute("aria-hidden")).toBe("true");
  expect(button.getAttribute("aria-disabled")).toBe("false");
  fireEvent.click(button);
  expect(props.onSelect).toHaveBeenCalledWith(node.id);

  // React uses the prefixed event in JSDOM, which has no AnimationEvent constructor.
  fireEvent(incoming, new Event("webkitAnimationEnd", { bubbles: true }));
  expect(tile.querySelector(".labyrinth-discovery-fog")).toBeNull();
  // Cleanup must not switch animations and restart the incoming fade.
  expect(incoming.getAttribute("data-crossfade")).toBe("true");
  props.rerender();
  expect(tile.querySelector(".labyrinth-discovery-fog")).toBeNull();

  node.cleared = true;
  props.map.currentNodeId = node.id;
  props.rerender();
  expect(tile.querySelector("img")!.getAttribute("src")).toBe(props.heroArt);
  expect(tile.querySelector(".labyrinth-discovery")!.hasAttribute("data-crossfade")).toBe(false);
  expect(tile.querySelector(".labyrinth-discovery-fog")).toBeNull();
});

it("distinguishes pointer focus from keyboard map inspection and clears it on scrolling", () => {
  renderViewport();
  const tile = document.querySelector<HTMLElement>('[data-labyrinth-node][data-state="undiscovered"]')!;
  const button = tile.querySelector("button")!;
  fireEvent.pointerDown(button);
  act(() => button.focus());
  expect(tile.getAttribute("data-emphasized")).toBe("false");
  act(() => button.blur());
  fireEvent.keyDown(document.body, { key: "Tab" });
  act(() => button.focus());
  expect(tile.getAttribute("data-emphasized")).toBe("true");
  fireEvent.wheel(document.body);
  expect(tile.getAttribute("data-emphasized")).toBe("false");
});
