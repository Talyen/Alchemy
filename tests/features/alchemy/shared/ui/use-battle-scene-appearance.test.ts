import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/preload", () => ({ waitForImage: vi.fn() }));

import { waitForImage } from "@/lib/preload";
import { NEUTRAL_BATTLE_SCENE_APPEARANCE } from "@/lib/animation/battle-scene-appearance";
import { useBattleSceneAppearance } from "@/features/alchemy/shared/ui/use-battle-scene-appearance";

const waits = new Map<string, (ready: boolean) => void>();
const drawImage = vi.fn();
const getImageData = vi.fn(() => ({ data: new Uint8ClampedArray([200, 100, 50, 255]) }));

describe("board sampling lifetime", () => {
  beforeEach(() => {
    waits.clear();
    drawImage.mockClear();
    getImageData.mockReset().mockReturnValue({ data: new Uint8ClampedArray([200, 100, 50, 255]) });
    vi.mocked(waitForImage)
      .mockReset()
      .mockImplementation((image) => {
        Object.defineProperties(image, { naturalWidth: { value: 640 }, naturalHeight: { value: 360 } });
        return new Promise((resolve) => {
          waits.set(image.getAttribute("src")!, resolve);
        });
      });
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue({
      drawImage,
      getImageData,
    } as unknown as CanvasRenderingContext2D);
  });

  afterEach(cleanup);

  async function finish(source: string, ready = true) {
    await act(async () => waits.get(source)!(ready));
  }

  it("samples the central crop once and shares cached work across consumers", async () => {
    const first = renderHook(() => useBattleSceneAppearance("/cached.webp"));
    const second = renderHook(() => useBattleSceneAppearance("/cached.webp"));
    expect(first.result.current).toEqual(NEUTRAL_BATTLE_SCENE_APPEARANCE);
    expect(waitForImage).toHaveBeenCalledTimes(1);
    await finish("/cached.webp");
    expect(first.result.current.ambientOpacity).toBe(0.06);
    expect(second.result.current).toEqual(first.result.current);
    expect(drawImage).toHaveBeenCalledWith(
      expect.any(HTMLImageElement),
      96,
      54,
      448,
      expect.closeTo(252),
      0,
      0,
      32,
      20,
    );
    expect(getImageData).toHaveBeenCalledTimes(1);
    first.unmount();
    second.unmount();
    const returning = renderHook(() => useBattleSceneAppearance("/cached.webp"));
    await waitFor(() => expect(returning.result.current.ambientOpacity).toBe(0.06));
    expect(waitForImage).toHaveBeenCalledTimes(1);
    expect(getImageData).toHaveBeenCalledTimes(1);
  });

  it("resets immediately on a board change and ignores out-of-order completion", async () => {
    const { result, rerender } = renderHook(({ source }) => useBattleSceneAppearance(source), {
      initialProps: { source: "/old.webp" as string | undefined },
    });
    rerender({ source: "/new.webp" });
    await finish("/new.webp");
    const current = result.current;
    await finish("/old.webp");
    expect(result.current).toBe(current);
    rerender({ source: "/next.webp" });
    expect(result.current).toEqual(NEUTRAL_BATTLE_SCENE_APPEARANCE);
    rerender({ source: undefined });
    await finish("/next.webp");
    expect(result.current).toEqual(NEUTRAL_BATTLE_SCENE_APPEARANCE);
  });

  it("does not publish a pending sample after unmount", async () => {
    const render = vi.fn(() => useBattleSceneAppearance("/unmounted.webp"));
    const hook = renderHook(render);
    const renders = render.mock.calls.length;
    hook.unmount();
    await finish("/unmounted.webp");
    expect(render).toHaveBeenCalledTimes(renders);
  });

  it("keeps neutral styling when loading or canvas access fails", async () => {
    const failed = renderHook(() => useBattleSceneAppearance("/missing.webp"));
    await finish("/missing.webp", false);
    expect(failed.result.current).toEqual(NEUTRAL_BATTLE_SCENE_APPEARANCE);
    expect(drawImage).not.toHaveBeenCalled();
    const blocked = renderHook(() => useBattleSceneAppearance("/blocked.webp"));
    getImageData.mockImplementationOnce(() => {
      throw new DOMException("Blocked", "SecurityError");
    });
    await finish("/blocked.webp");
    expect(blocked.result.current).toEqual(NEUTRAL_BATTLE_SCENE_APPEARANCE);
    const absent = renderHook(() => useBattleSceneAppearance(undefined));
    expect(absent.result.current).toEqual(NEUTRAL_BATTLE_SCENE_APPEARANCE);
    expect(waitForImage).toHaveBeenCalledTimes(2);
  });
});
