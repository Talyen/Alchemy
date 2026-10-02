import { afterEach, expect, it, vi } from "vitest";
import { startWebGLKeywordPlasma } from "@/lib/animation/keyword-plasma-webgl";
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  document.body.replaceChildren();
});
it.each(["shader", "program"])("releases allocated shaders after %s initialization failure", (failure) => {
  const vertex = {},
    fragment = {};
  const gl = {
    VERTEX_SHADER: 1,
    FRAGMENT_SHADER: 2,
    COMPILE_STATUS: 3,
    createShader: vi.fn().mockReturnValueOnce(vertex).mockReturnValueOnce(fragment),
    shaderSource: vi.fn(),
    compileShader: vi.fn(),
    deleteShader: vi.fn(),
    getShaderParameter: vi
      .fn()
      .mockReturnValueOnce(true)
      .mockReturnValueOnce(failure !== "shader"),
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
  expect(gl.deleteShader).toHaveBeenCalledWith(fragment);
  expect(gl.deleteShader).toHaveBeenCalledTimes(2);
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
        "linkProgram",
        "bindBuffer",
        "bufferData",
        "enableVertexAttribArray",
        "vertexAttribPointer",
        "useProgram",
        "enable",
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
  Object.defineProperty(parent, "clientWidth", { value: 3840 });
  Object.defineProperty(parent, "clientHeight", { value: 2160 });
  const canvas = document.createElement("canvas");
  parent.appendChild(canvas);
  document.body.appendChild(parent);
  vi.spyOn(canvas, "getContext").mockReturnValue(gl as unknown as WebGLRenderingContext);
  vi.spyOn(document, "hasFocus").mockReturnValue(true);
  vi.spyOn(performance, "now").mockReturnValue(1000);
  vi.stubGlobal("devicePixelRatio", 2);
  let frame: FrameRequestCallback = () => {};
  vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
    frame = callback;
    return 1;
  });
  const cancel = vi.fn();
  vi.stubGlobal("cancelAnimationFrame", cancel);
  const stop = startWebGLKeywordPlasma({
    canvas,
    colorsRef: { current: { primary: "#ffffff", secondary: "#000000" } },
    focalYOffset: 0,
    active: () => true,
  });
  expect(stop).not.toBeNull();
  expect(canvas.width * canvas.height).toBeLessThanOrEqual(1_500_000);
  expect(canvas.width).toBeGreaterThan(0);
  frame(1100);
  expect(gl.uniform1f).toHaveBeenLastCalledWith("uTime", 0.1);
  frame(1110);
  expect(gl.drawArrays).toHaveBeenCalledOnce();
  frame(1140);
  expect(gl.drawArrays).toHaveBeenCalledTimes(2);
  stop!();
  expect(cancel).toHaveBeenCalledOnce();
  frame(1200);
  expect(gl.drawArrays).toHaveBeenCalledTimes(2);
});
