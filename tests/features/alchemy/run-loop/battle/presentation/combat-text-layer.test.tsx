import { act, cleanup, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi, type MockInstance } from "vitest";
import { CombatTextLayer } from "@/features/alchemy/run-loop/battle/presentation/combat-text-layer";
import { battlePresentation } from "@/app/battle-presentation";
import { resetBattlePresentationAndRun } from "../battle-test-reset";
import { mutateRunForTest, setBattleActiveForTest } from "../../../../../helpers/run-domain-store-test";
import { setScreen } from "@/features/alchemy/shared/stores/commands/run-session-write-port";
import type { BattleRefs, CombatTextBurst } from "@/features/alchemy/shared/types";
import { secondaryStatusFeedbackKey } from "@/features/alchemy/run-loop/battle/presentation/combat-status-feedback";
import { combatTextLane } from "@/features/alchemy/run-loop/battle/combat-feedback-motion";

vi.mock("@/features/alchemy/run-loop/battle/presentation/ui/combat-text", () => ({
  CombatTextRail: ({ bursts }: { bursts: CombatTextBurst[] }) => (
    <div>
      {bursts.map((burst) => (
        <span key={burst.id} data-burst-id={burst.target}>
          {burst.entries.map((entry) => (
            <span
              key={entry.id}
              data-stat={entry.stat}
              data-kind={entry.kind}
              data-intent={entry.feedback}
              data-secondary-status-feedback={secondaryStatusFeedbackKey(entry, combatTextLane(entry))}
            />
          ))}
        </span>
      ))}
    </div>
  ),
}));

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
      endTurnButtonRef: { current: null },
      handCardRefs: { current: {} },
      drawPileRef: { current: null },
      discardPileRef: { current: null },
    };
    resetBattlePresentationAndRun();
    mutateRunForTest((draft) => {
      setBattleActiveForTest(draft, true);
      setScreen(draft, "battle");
    });
    battlePresentation.getState().showCombatTexts([
      { target: "player", kind: "damage", stat: "physical", amount: 1 },
      { target: "enemy", kind: "damage", stat: "physical", amount: 1 },
    ]);
  });

  afterEach(() => {
    cleanup();
    battlePresentation.getState().resetPresentation();
    scene.remove();
    frames.clear();
    vi.unstubAllGlobals();
  });

  function nextFrame() {
    const pending = [...frames.values()];
    frames.clear();
    act(() => pending.forEach((callback) => callback(16)));
  }

  function statusRow(target: "player" | "enemy", ids: string[]) {
    const row = document.createElement("div");
    row.dataset.combatStatusTarget = target;
    for (const id of ids) {
      const chip = document.createElement("button");
      chip.dataset.combatStatusId = id;
      vi.spyOn(chip, "getBoundingClientRect").mockReturnValue(new DOMRect(140, 420, 36, 36));
      row.append(chip);
    }
    scene.append(row);
    return row;
  }

  it("deduplicates only visible same-recipient secondary gains and restores their fallback as the row changes", () => {
    const row = statusRow("player", ["block", "thorns"]);
    battlePresentation.getState().clearFloatingCombatTexts();
    battlePresentation.getState().showCombatTexts([
      { target: "player", kind: "status", stat: "block", amount: 6, feedback: "primary" },
      { target: "player", kind: "status", stat: "thorns", amount: 2, feedback: "secondary" },
      { target: "enemy", kind: "status", stat: "thorns", amount: 2, feedback: "secondary" },
      { target: "player", kind: "heal", stat: "health", amount: 3, feedback: "secondary" },
      { target: "player", kind: "damage", stat: "block", amount: 2, feedback: "secondary" },
    ]);
    const { container } = render(<CombatTextLayer presentation={battlePresentation} refs={refs} />);
    const own = container.querySelector<HTMLElement>('[data-secondary-status-feedback="player:thorns"]')!;
    const other = container.querySelector<HTMLElement>('[data-secondary-status-feedback="enemy:thorns"]')!;
    expect(own.style.visibility).toBe("hidden");
    expect(own.getAttribute("aria-hidden")).toBe("true");
    expect(other.style.visibility).toBe("");
    expect(container.querySelector('[data-stat="block"][data-intent="primary"]')?.getAttribute("style")).toBeNull();
    expect(container.querySelectorAll("[data-secondary-status-feedback]")).toHaveLength(2);

    row.hidden = true;
    nextFrame();
    expect(own.style.visibility).toBe("");
    expect(own.hasAttribute("aria-hidden")).toBe(false);
    row.hidden = false;
    nextFrame();
    expect(own.style.visibility).toBe("hidden");
    row.remove();
    nextFrame();
    expect(own.style.visibility).toBe("");
    // A newly rendered status can replace its fallback during the same receipt.
    statusRow("player", ["thorns"]);
    nextFrame();
    expect(own.style.visibility).toBe("hidden");
    expect(container.querySelector('[data-secondary-status-feedback="player:thorns"]')).toBe(own);
  });

  it("keeps the sole feedback for overflow, offscreen, transparent and unrendered statuses", () => {
    const row = statusRow("player", ["thorns"]);
    row.style.overflow = "hidden";
    const clip = vi.spyOn(row, "getBoundingClientRect").mockReturnValue(new DOMRect(130, 410, 35, 50));
    battlePresentation.getState().clearFloatingCombatTexts();
    battlePresentation
      .getState()
      .showCombatTexts([{ target: "player", kind: "status", stat: "thorns", amount: 2, feedback: "secondary" }]);
    const { container } = render(<CombatTextLayer presentation={battlePresentation} refs={refs} />);
    const feedback = container.querySelector<HTMLElement>("[data-secondary-status-feedback]")!;
    expect(feedback.style.visibility).toBe("");
    clip.mockReturnValue(new DOMRect(130, 410, 100, 50));
    nextFrame();
    expect(feedback.style.visibility).toBe("hidden");
    row.style.opacity = "0";
    nextFrame();
    expect(feedback.style.visibility).toBe("");
    row.style.opacity = "1";
    const chip = row.firstElementChild as HTMLElement;
    vi.spyOn(chip, "getBoundingClientRect").mockReturnValue(new DOMRect(-10, 420, 36, 36));
    nextFrame();
    expect(feedback.style.visibility).toBe("");
    chip.remove();
    nextFrame();
    expect(feedback.style.visibility).toBe("");
  });

  it.each(
    (
      [
        { stat: "stun", chip: "stunned", target: "enemy", other: "player", text: "Stunned" },
        { stat: "freeze", chip: "frozen", target: "player", other: "enemy", text: "Frozen" },
      ] as const
    ).flatMap((status) => [
      { ...status, feedback: "secondary" as const, intent: "secondary" },
      { ...status, feedback: undefined, intent: "untagged" },
    ]),
  )(
    "deduplicates $intent $chip only against its recipient's visible active chip",
    ({ stat, chip, target, other, text, feedback }) => {
      const buildup = statusRow(target, [stat]);
      battlePresentation.getState().clearFloatingCombatTexts();
      battlePresentation.getState().showCombatTexts([
        { target, kind: "notice", stat, text, feedback },
        { target: other, kind: "notice", stat, text, feedback },
        { target, kind: "damage", stat, amount: 60, feedback: "primary" },
      ]);
      const { container } = render(<CombatTextLayer presentation={battlePresentation} refs={refs} />);
      const own = container.querySelector<HTMLElement>(`[data-secondary-status-feedback="${target}:${chip}"]`)!;
      const otherNotice = container.querySelector<HTMLElement>(`[data-secondary-status-feedback="${other}:${chip}"]`)!;
      expect(own.style.visibility).toBe("");
      const row = statusRow(target, [chip]);
      nextFrame();
      expect(own.style.visibility).toBe("hidden");
      expect(otherNotice.style.visibility).toBe("");
      expect(container.querySelector('[data-kind="damage"][data-intent="primary"]')?.getAttribute("style")).toBeNull();
      expect(
        secondaryStatusFeedbackKey({ target, kind: "notice", stat, text, feedback: "primary" }, "impact"),
      ).toBeUndefined();
      expect(secondaryStatusFeedbackKey({ target, kind: "notice", stat, text }, "setback")).toBe(`${target}:${chip}`);
      expect(
        secondaryStatusFeedbackKey(
          { target, kind: "notice", stat, text, signal: "cleanse", feedback: "secondary" },
          "benefit",
        ),
      ).toBeUndefined();
      row.hidden = true;
      nextFrame();
      expect(own.style.visibility).toBe("");
      row.hidden = false;
      row.style.overflow = "hidden";
      vi.spyOn(row, "getBoundingClientRect").mockReturnValue(new DOMRect(130, 410, 35, 50));
      nextFrame();
      expect(own.style.visibility).toBe("");
      row.style.overflow = "visible";
      nextFrame();
      expect(own.style.visibility).toBe("hidden");
      row.remove();
      nextFrame();
      expect(own.style.visibility).toBe("");
      buildup.remove();
    },
  );

  it("keeps both overlays pinned through movement and portrait replacement using one scene read per frame", () => {
    const { container } = render(<CombatTextLayer presentation={battlePresentation} refs={refs} />);
    const layers = container.querySelectorAll<HTMLDivElement>('[data-testid="combat-text-layer"]');
    const playerLayer = layers[0]!;
    const enemyLayer = layers[1]!;
    expect(playerLayer.style.transform).toBe("translate3d(10px, 20px, 0)");
    expect(playerLayer.style.width).toBe("100px");
    expect(playerLayer.style.height).toBe("150px");
    expect(enemyLayer.style.transform).toBe("translate3d(200px, 30px, 0)");
    expect(sceneBounds).toHaveBeenCalledTimes(1);
    expect(frames.size).toBe(1);
    for (let step = 1; step <= 4; step++) {
      vi.spyOn(refs.playerPanelRef.current!, "getBoundingClientRect").mockReturnValue(
        new DOMRect(120, 90, 200 + step * 0.6, 300 + step * 0.6),
      );
      nextFrame();
    }
    expect(playerLayer.style.width).toBe("101.2px");
    expect(playerLayer.style.height).toBe("151.2px");
    sceneBounds.mockClear();
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
    expect(sceneBounds).toHaveBeenCalledTimes(1);
    expect(frames.size).toBe(1);

    act(() => battlePresentation.getState().clearFloatingCombatTexts());
    expect(container.querySelector('[data-testid="combat-text-layer"]')).toBeNull();
    expect(frames.size).toBe(0);
  });

  it("keeps an unmeasurable portrait hidden and begins tracking when its ref becomes available", () => {
    refs.playerPanelRef.current = null;
    battlePresentation.getState().clearFloatingCombatTexts();
    battlePresentation.getState().showCombatTexts([{ target: "player", kind: "damage", stat: "physical", amount: 1 }]);
    const { container, unmount } = render(<CombatTextLayer presentation={battlePresentation} refs={refs} />);
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
