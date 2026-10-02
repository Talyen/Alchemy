import { act, cleanup, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi, type MockInstance } from "vitest";
import { CombatTextLayer } from "@/features/alchemy/run-loop/battle/presentation/combat-text-layer";
import { useBattlePresentationStore } from "@/features/alchemy/run-loop/battle/battle-presentation-store";
import type { BattleRefs, CombatTextBurst } from "@/features/alchemy/shared/types";

vi.mock("@/features/alchemy/run-loop/battle/presentation/ui/combat-text", () => ({
  CombatTextRail: ({ bursts }: { bursts: CombatTextBurst[] }) => (
    <div>
      {bursts.map((burst) => (
        <span key={burst.id} data-burst-id={burst.id} />
      ))}
    </div>
  ),
}));

function burst(target: "player" | "enemy"): CombatTextBurst {
  return { target, id: target, entries: [], lifetimeMs: 1100, firstShownAt: 0 };
}

describe("CombatTextLayer geometry", () => {
  const frames = new Map<number, FrameRequestCallback>();
  let scene: HTMLDivElement;
  let refs: BattleRefs;
  let sceneBounds: MockInstance<() => DOMRect>;

  beforeEach(() => {
    let nextId = 0;
    vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
      const id = ++nextId;
      frames.set(id, callback);
      return id;
    });
    vi.stubGlobal("cancelAnimationFrame", (id: number) => frames.delete(id));
    scene = document.createElement("div");
    const player = document.createElement("div");
    const enemy = document.createElement("div");
    scene.append(player, enemy);
    document.body.append(scene);
    Object.defineProperties(scene, { offsetWidth: { value: 400 }, offsetHeight: { value: 300 } });
    sceneBounds = vi.spyOn(scene, "getBoundingClientRect").mockReturnValue(new DOMRect(100, 50, 800, 600));
    vi.spyOn(player, "getBoundingClientRect").mockReturnValue(new DOMRect(120, 90, 200, 300));
    vi.spyOn(enemy, "getBoundingClientRect").mockReturnValue(new DOMRect(500, 110, 180, 280));
    refs = {
      battleSceneRef: { current: scene },
      playerPanelRef: { current: player },
      enemyPanelRef: { current: enemy },
      handCardRefs: { current: {} },
      drawPileRef: { current: null },
      discardPileRef: { current: null },
    };
    useBattlePresentationStore.setState({ floatingCombatBursts: [burst("player"), burst("enemy")] });
  });

  afterEach(() => {
    cleanup();
    useBattlePresentationStore.getState().resetPresentation();
    scene.remove();
    frames.clear();
    vi.unstubAllGlobals();
  });

  function nextFrame() {
    const pending = [...frames.values()];
    frames.clear();
    act(() => pending.forEach((callback) => callback(16)));
  }

  it("keeps both overlays pinned through movement and portrait replacement using one scene read per frame", () => {
    const { container } = render(<CombatTextLayer refs={refs} />);
    const layers = container.querySelectorAll<HTMLDivElement>('[data-testid="combat-text-layer"]');
    const playerLayer = layers[0]!;
    const enemyLayer = layers[1]!;
    expect(playerLayer.style.transform).toBe("translate3d(10px, 20px, 0)");
    expect(playerLayer.style.width).toBe("100px");
    expect(playerLayer.style.height).toBe("150px");
    expect(enemyLayer.style.transform).toBe("translate3d(200px, 30px, 0)");
    expect(sceneBounds).toHaveBeenCalledTimes(1);
    expect(frames.size).toBe(1);
    const playerBurst = playerLayer.querySelector('[data-burst-id="player"]');

    vi.spyOn(refs.playerPanelRef.current!, "getBoundingClientRect").mockReturnValue(new DOMRect(160, 110, 240, 400));
    const replacement = document.createElement("div");
    refs.enemyPanelRef.current!.replaceWith(replacement);
    refs.enemyPanelRef.current = replacement;
    let playerTransformAtEnemyRead = "";
    vi.spyOn(replacement, "getBoundingClientRect").mockImplementation(() => {
      playerTransformAtEnemyRead = playerLayer.style.transform;
      return new DOMRect(460, 130, 180, 280);
    });
    nextFrame();

    expect(playerTransformAtEnemyRead).toBe("translate3d(10px, 20px, 0)");
    expect(playerLayer.style.transform).toBe("translate3d(30px, 30px, 0)");
    expect(playerLayer.style.width).toBe("120px");
    expect(playerLayer.style.height).toBe("200px");
    expect(enemyLayer.style.transform).toBe("translate3d(180px, 40px, 0)");
    expect(playerLayer.querySelector('[data-burst-id="player"]')).toBe(playerBurst);
    expect(sceneBounds).toHaveBeenCalledTimes(2);
    expect(frames.size).toBe(1);

    act(() => useBattlePresentationStore.setState({ floatingCombatBursts: [] }));
    expect(container.querySelector('[data-testid="combat-text-layer"]')).toBeNull();
    expect(frames.size).toBe(0);
  });

  it("keeps an unmeasurable portrait hidden and begins tracking when its ref becomes available", () => {
    refs.playerPanelRef.current = null;
    useBattlePresentationStore.setState({ floatingCombatBursts: [burst("player")] });
    const { container, unmount } = render(<CombatTextLayer refs={refs} />);
    const layer = container.querySelector<HTMLDivElement>('[data-testid="combat-text-layer"]')!;
    expect(layer.style.visibility).toBe("hidden");
    const player = document.createElement("div");
    scene.append(player);
    refs.playerPanelRef.current = player;
    vi.spyOn(player, "getBoundingClientRect").mockReturnValue(new DOMRect(120, 90, 200, 300));
    nextFrame();
    expect(layer.style.visibility).toBe("visible");
    expect(layer.style.transform).toBe("translate3d(10px, 20px, 0)");
    unmount();
    expect(frames.size).toBe(0);
  });
});
