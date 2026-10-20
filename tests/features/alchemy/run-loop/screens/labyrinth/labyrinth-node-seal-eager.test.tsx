import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { LabyrinthNodeSeal } from "@/features/alchemy/run-loop/screens/labyrinth/labyrinth-node-seal";
import { gridLabyrinthMapFixture } from "../../../../../fixtures/labyrinth-map";

afterEach(cleanup);

describe("LabyrinthNodeSeal", () => {
  it("loads seal art eagerly", () => {
    const map = gridLabyrinthMapFixture();
    const node = map.nodes["labyrinth-floor-1-n0"]!;
    render(
      <LabyrinthNodeSeal
        node={node}
        visual="reachable"
        current={false}
        heroArt="/knight.webp"
        selected={false}
        emphasized={false}
        x={0}
        y={0}
        width={100}
        height={75}
        onSelect={vi.fn()}
        onHover={vi.fn()}
        onFocus={vi.fn()}
      />,
    );
    const art = document.querySelector("[data-labyrinth-node] img");
    expect(art?.getAttribute("loading")).toBe("eager");
  });
});
