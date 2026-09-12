import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { resolvePlasmaBackingScale } from "@/lib/animation/keyword-plasma-lifecycle";
import { startKeywordPlasma } from "@/lib/animation/keyword-plasma";
import { startWebGLKeywordPlasma } from "@/lib/animation/keyword-plasma-webgl";

vi.mock("@/lib/animation/keyword-plasma-webgl", () => ({ startWebGLKeywordPlasma: vi.fn() }));
vi.mock("@/lib/error-logger", () => ({ logError: vi.fn() }));

beforeEach(() => vi.clearAllMocks());
afterEach(() => vi.unstubAllGlobals());

it("bounds the backing surface on large displays", () => {
  vi.stubGlobal("devicePixelRatio", 2);
  const scale = resolvePlasmaBackingScale(3840, 2160);
  expect(3840 * 2160 * scale * scale).toBeLessThanOrEqual(1_500_001);
  expect(scale).toBeGreaterThan(0);
});

describe("plasma availability", () => {
  function setup() {
    const canvas = document.createElement("canvas");
    const available = vi.fn();
    const cleanup = startKeywordPlasma({
      canvas,
      colorsRef: { current: { primary: "#ff0000", secondary: "#0000ff" } },
      focalYOffset: 0,
      active: () => true,
      onAvailabilityChange: available,
    });
    return { canvas, available, cleanup };
  }
  it("reports failed initialization for static decoration without scheduling retries", () => {
    vi.mocked(startWebGLKeywordPlasma).mockReturnValue(null);
    const { canvas, available, cleanup } = setup();
    expect(available).toHaveBeenLastCalledWith(false);
    cleanup();
    canvas.dispatchEvent(new Event("webglcontextrestored"));
    expect(startWebGLKeywordPlasma).toHaveBeenCalledTimes(1);
  });
  it("stops a lost context, rebuilds on restoration, and removes all listeners on cleanup", () => {
    const firstStop = vi.fn(),
      secondStop = vi.fn();
    vi.mocked(startWebGLKeywordPlasma).mockReturnValueOnce(firstStop).mockReturnValueOnce(secondStop);
    const { canvas, available, cleanup } = setup();
    expect(available).toHaveBeenLastCalledWith(true);
    const lost = new Event("webglcontextlost", { cancelable: true });
    canvas.dispatchEvent(lost);
    expect(lost.defaultPrevented).toBe(true);
    expect(firstStop).toHaveBeenCalledOnce();
    expect(available).toHaveBeenLastCalledWith(false);
    canvas.dispatchEvent(new Event("webglcontextrestored"));
    expect(available).toHaveBeenLastCalledWith(true);
    cleanup();
    expect(secondStop).toHaveBeenCalledOnce();
    canvas.dispatchEvent(new Event("webglcontextrestored"));
    expect(startWebGLKeywordPlasma).toHaveBeenCalledTimes(2);
  });
  it("keeps the fallback when restoration cannot rebuild resources", () => {
    vi.mocked(startWebGLKeywordPlasma).mockReturnValueOnce(vi.fn()).mockReturnValueOnce(null);
    const { canvas, available, cleanup } = setup();
    canvas.dispatchEvent(new Event("webglcontextlost", { cancelable: true }));
    canvas.dispatchEvent(new Event("webglcontextrestored"));
    expect(available).toHaveBeenLastCalledWith(false);
    cleanup();
  });
});
