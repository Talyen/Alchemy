import { afterEach, expect, it, vi } from "vitest";
import { startWebGLKeywordPlasma } from "@/lib/animation/keyword-plasma-webgl";
afterEach(() => vi.restoreAllMocks());
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
