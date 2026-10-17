import { describe, expect, it, vi } from "vitest";
import { createWebGLProgram } from "@/lib/animation/webgl-program";

function setup(linked: boolean) {
  const vertex = {};
  const fragment = {};
  const program = {};
  const attached = new Set<unknown>();
  const deleted = new Set<unknown>();
  const events: string[] = [];
  const gl = {
    VERTEX_SHADER: 1,
    FRAGMENT_SHADER: 2,
    LINK_STATUS: 3,
    createShader: vi.fn().mockReturnValueOnce(vertex).mockReturnValueOnce(fragment),
    shaderSource: vi.fn(),
    compileShader: vi.fn(),
    getShaderParameter: vi.fn(),
    createProgram: vi.fn<() => object | null>(() => program),
    attachShader: vi.fn((_program: unknown, shader: unknown) => attached.add(shader)),
    linkProgram: vi.fn(() => events.push("link")),
    detachShader: vi.fn((_program: unknown, shader: unknown) => {
      attached.delete(shader);
      events.push("detach");
    }),
    deleteShader: vi.fn((shader: unknown) => deleted.add(shader)),
    getProgramParameter: vi.fn(() => linked),
    deleteProgram: vi.fn(),
  };
  return { gl, vertex, fragment, program, attached, deleted, events };
}

describe("createWebGLProgram", () => {
  it("keeps the linked program while releasing its shader attachments without compile-status round trips", () => {
    const { gl, vertex, fragment, program, attached, deleted, events } = setup(true);
    expect(createWebGLProgram(gl as unknown as WebGLRenderingContext, "vertex", "fragment")).toBe(program);
    expect(gl.shaderSource.mock.calls).toEqual([
      [vertex, "vertex"],
      [fragment, "fragment"],
    ]);
    expect(events).toEqual(["link", "detach", "detach"]);
    expect(attached.size).toBe(0);
    expect(deleted).toEqual(new Set([vertex, fragment]));
    expect(gl.getShaderParameter).not.toHaveBeenCalled();
    expect(gl.getProgramParameter).toHaveBeenCalledExactlyOnceWith(program, gl.LINK_STATUS);
    expect(gl.deleteProgram).not.toHaveBeenCalled();
  });

  it("releases the program and both shaders when linking detects a compile or link failure", () => {
    const { gl, vertex, fragment, program, attached, deleted } = setup(false);
    expect(createWebGLProgram(gl as unknown as WebGLRenderingContext, "bad vertex", "bad fragment")).toBeNull();
    expect(attached.size).toBe(0);
    expect(deleted).toEqual(new Set([vertex, fragment]));
    expect(gl.deleteProgram).toHaveBeenCalledExactlyOnceWith(program);
  });
  it.each(["compile", "link"])("rolls back allocated GPU resources when %s throws", (stage) => {
    const { gl, vertex, fragment, program, deleted } = setup(true);
    const fail = () => {
      throw new Error("GPU setup failed");
    };
    if (stage === "compile") gl.compileShader.mockImplementation(fail);
    else gl.linkProgram.mockImplementation(fail);
    expect(() => createWebGLProgram(gl as unknown as WebGLRenderingContext, "vertex", "fragment")).toThrow(
      "GPU setup failed",
    );
    expect(deleted).toEqual(new Set(stage === "compile" ? [vertex] : [vertex, fragment]));
    if (stage === "link") expect(gl.deleteProgram).toHaveBeenCalledWith(program);
  });
});

it.each(["shader", "program"])("releases shaders after %s allocation failure", (failure) => {
  const { gl, vertex, fragment, deleted } = setup(true);
  if (failure === "shader") gl.createShader.mockReset().mockReturnValueOnce(vertex).mockReturnValueOnce(null);
  else gl.createProgram.mockReturnValue(null);
  expect(createWebGLProgram(gl as unknown as WebGLRenderingContext, "vertex", "fragment")).toBeNull();
  expect(deleted).toEqual(new Set(failure === "shader" ? [vertex] : [vertex, fragment]));
});
