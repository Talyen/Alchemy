import { afterEach, expect, it, vi } from "vitest";
import { startWebGLKeywordPlasma } from "@/lib/animation/keyword-plasma-webgl";
import type { PlasmaColorState } from "@/lib/animation/keyword-plasma-types";
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  document.body.replaceChildren();
});
it.each(["shader", "program"])("releases allocated shaders after %s allocation failure", (failure) => {
  const vertex = {},
    fragment = {};
  const gl = {
    VERTEX_SHADER: 1,
    FRAGMENT_SHADER: 2,
    COMPILE_STATUS: 3,
    createShader: vi
      .fn()
      .mockReturnValueOnce(vertex)
      .mockReturnValueOnce(failure === "shader" ? null : fragment),
    shaderSource: vi.fn(),
    compileShader: vi.fn(),
    deleteShader: vi.fn(),
    createProgram: vi.fn().mockReturnValue(null),
  };
  const canvas = document.createElement("canvas");
  vi.spyOn(canvas, "getContext").mockReturnValue(gl as unknown as WebGLRenderingContext);
  const result = startWebGLKeywordPlasma({
    canvas,
    colorsRef: { current: { primary: "#ffffff", secondary: "#000000" } },
    focalYOffset: 0,
    active: () => true,
  });
  expect(result).toBeNull();
  expect(gl.deleteShader).toHaveBeenCalledWith(vertex);
  if (failure === "program") expect(gl.deleteShader).toHaveBeenCalledWith(fragment);
  expect(gl.deleteShader).toHaveBeenCalledTimes(failure === "shader" ? 1 : 2);
});

it("uses bounded backing dimensions, elapsed seconds, and 30fps pacing through the canvas lifecycle", () => {
  const gl = {
    createShader: () => ({}),
    getShaderParameter: () => true,
    createProgram: () => ({}),
    getProgramParameter: () => true,
    createBuffer: () => ({}),
    getAttribLocation: () => 0,
    getUniformLocation: (_program: unknown, name: string) => name,
    ...Object.fromEntries(
      [
        "shaderSource",
        "compileShader",
        "deleteShader",
        "attachShader",
        "detachShader",
        "linkProgram",
        "bindBuffer",
        "bufferData",
        "enableVertexAttribArray",
        "vertexAttribPointer",
        "useProgram",
        "enable",
        "disable",
        "blendFunc",
        "viewport",
        "clearColor",
        "clear",
        "uniform2f",
        "uniform3f",
        "deleteBuffer",
        "deleteProgram",
      ].map((name) => [name, vi.fn()]),
    ),
    uniform1f: vi.fn(),
    drawArrays: vi.fn(),
  };
  const parent = document.createElement("div");
  Object.defineProperty(parent, "clientWidth", { value: 3840, configurable: true });
  Object.defineProperty(parent, "clientHeight", { value: 2160, configurable: true });
  const canvas = document.createElement("canvas");
  parent.appendChild(canvas);
  document.body.appendChild(parent);
  vi.spyOn(canvas, "getContext").mockReturnValue(gl as unknown as WebGLRenderingContext);
  vi.spyOn(document, "hasFocus").mockReturnValue(true);
  vi.spyOn(performance, "now").mockReturnValue(1000);
  vi.stubGlobal("devicePixelRatio", 2);
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {}
      disconnect() {}
    },
  );
  let frame: FrameRequestCallback = () => {};
  vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
    frame = callback;
    return 1;
  });
  const cancel = vi.fn();
  vi.stubGlobal("cancelAnimationFrame", cancel);
  const colorsRef: { current: PlasmaColorState } = {
    current: { primary: "#ffffff", secondary: "#000000" },
  };
  const stop = startWebGLKeywordPlasma({
    canvas,
    colorsRef,
    focalYOffset: 32,
    active: () => true,
  });
  expect(stop).not.toBeNull();
  expect(canvas.width * canvas.height).toBeLessThanOrEqual(1_500_000);
  expect(canvas.width).toBeGreaterThan(0);
  expect(canvas.getContext).toHaveBeenCalledWith("webgl", {
    alpha: true,
    premultipliedAlpha: true,
    antialias: false,
    depth: false,
    stencil: false,
  });
  expect(gl.viewport).toHaveBeenCalledExactlyOnceWith(0, 0, canvas.width, canvas.height);
  expect(gl.uniform2f).toHaveBeenCalledWith("uSize", canvas.width, canvas.height);
  expect(gl.uniform2f).toHaveBeenCalledWith(
    "uFocalCenter",
    canvas.width / 2,
    canvas.height / 2 - 32 * (canvas.height / 2160),
  );
  frame(1100);
  expect(gl.uniform1f).toHaveBeenLastCalledWith("uTime", 0.1);
  frame(1110);
  expect(gl.drawArrays).toHaveBeenCalledOnce();
  frame(1140);
  expect(gl.drawArrays).toHaveBeenCalledTimes(2);
  expect(gl.viewport).toHaveBeenCalledOnce();
  expect(gl.uniform2f).toHaveBeenCalledTimes(2);
  expect(gl.uniform3f).toHaveBeenCalledTimes(2);
  expect(gl.uniform3f).toHaveBeenCalledWith("uPrimary", 1, 1, 1);
  expect(gl.uniform3f).toHaveBeenCalledWith("uSecondary", 0, 0, 0);

  Object.defineProperty(parent, "clientWidth", { value: 800, configurable: true });
  Object.defineProperty(parent, "clientHeight", { value: 600, configurable: true });
  window.dispatchEvent(new Event("focus"));
  expect(gl.viewport).toHaveBeenLastCalledWith(0, 0, canvas.width, canvas.height);
  expect(gl.uniform2f).toHaveBeenCalledWith("uSize", canvas.width, canvas.height);
  expect(gl.uniform2f).toHaveBeenLastCalledWith(
    "uFocalCenter",
    canvas.width / 2,
    canvas.height / 2 - 32 * (canvas.height / 600),
  );

  // DPR changes are detected by the frame loop even without an observer event.
  vi.stubGlobal("devicePixelRatio", 1);
  frame(1180);
  expect(gl.viewport).toHaveBeenCalledTimes(3);
  expect(gl.uniform2f).toHaveBeenLastCalledWith(
    "uFocalCenter",
    canvas.width / 2,
    canvas.height / 2 - 32 * (canvas.height / 600),
  );
  expect(gl.drawArrays).toHaveBeenCalledTimes(3);
  expect(gl.uniform3f).toHaveBeenCalledTimes(2);

  const primary: [number, number, number] = [0.1, 0.2, 0.3];
  colorsRef.current.primary = primary;
  frame(1220);
  expect(gl.uniform3f).toHaveBeenCalledTimes(3);
  expect(gl.uniform3f).toHaveBeenLastCalledWith("uPrimary", 0.1, 0.2, 0.3);
  primary[0] = 0.4;
  frame(1260);
  expect(gl.uniform3f).toHaveBeenCalledTimes(4);
  expect(gl.uniform3f).toHaveBeenLastCalledWith("uPrimary", 0.4, 0.2, 0.3);
  expect(gl.drawArrays).toHaveBeenCalledTimes(5);
  stop!();
  expect(cancel).toHaveBeenCalledOnce();
  frame(1300);
  expect(gl.drawArrays).toHaveBeenCalledTimes(5);
});
