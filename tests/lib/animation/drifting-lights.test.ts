import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { startDriftingLights } from "@/lib/animation/drifting-lights";

vi.mock("@/lib/error-logger", () => ({ logError: vi.fn() }));

function createMockWebGLCanvas(): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  const parent = document.createElement("div");
  Object.defineProperty(parent, "clientWidth", { value: 300, configurable: true });
  Object.defineProperty(parent, "clientHeight", { value: 200, configurable: true });
  parent.appendChild(canvas);
  document.body.appendChild(parent);

  const mockGl = {
    createShader: vi.fn(() => ({})),
    shaderSource: vi.fn(),
    compileShader: vi.fn(),
    getShaderParameter: vi.fn(() => true),
    createProgram: vi.fn(() => ({})),
    attachShader: vi.fn(),
    linkProgram: vi.fn(),
    getProgramParameter: vi.fn(() => true),
    deleteShader: vi.fn(),
    deleteProgram: vi.fn(),
    getAttribLocation: vi.fn(() => 0),
    getUniformLocation: vi.fn(() => ({})),
    createBuffer: vi.fn(() => ({})),
    deleteBuffer: vi.fn(),
    bindBuffer: vi.fn(),
    bufferData: vi.fn(),
    enableVertexAttribArray: vi.fn(),
    vertexAttribPointer: vi.fn(),
    useProgram: vi.fn(),
    disable: vi.fn(),
    viewport: vi.fn(),
    uniform2f: vi.fn(),
    uniform1f: vi.fn(),
    drawArrays: vi.fn(),
    isContextLost: vi.fn(() => false),
    STATIC_DRAW: 35044,
    ARRAY_BUFFER: 34962,
    FLOAT: 5126,
    BLEND: 3042,
    DITHER: 3024,
    TRIANGLES: 4,
    VERTEX_SHADER: 35633,
    FRAGMENT_SHADER: 35632,
    COMPILE_STATUS: 35713,
    LINK_STATUS: 35714,
  };

  canvas.getContext = vi.fn((type: string) => {
    if (type === "webgl") return mockGl as unknown as WebGLRenderingContext;
    return null;
  }) as unknown as typeof canvas.getContext;

  return canvas;
}

describe("startDriftingLights", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    document.body.replaceChildren();
    vi.restoreAllMocks();
  });

  it("initializes WebGL program, reports availability, and updates settings", () => {
    const canvas = createMockWebGLCanvas();
    const onAvailable = vi.fn();

    const controller = startDriftingLights(canvas, onAvailable);

    expect(onAvailable).toHaveBeenCalledWith(true);

    controller.update({ strength: 50, motion: "flowing" });
    controller.dispose();
  });

  it("handles WebGL failure gracefully by notifying onAvailable(false)", () => {
    const canvas = document.createElement("canvas");
    canvas.getContext = vi.fn(() => null) as unknown as typeof canvas.getContext;
    const onAvailable = vi.fn();

    const controller = startDriftingLights(canvas, onAvailable);

    expect(onAvailable).toHaveBeenCalledWith(false);
    controller.dispose();
  });

  it("handles webglcontextlost and restored events", () => {
    const canvas = createMockWebGLCanvas();
    const onAvailable = vi.fn();

    const controller = startDriftingLights(canvas, onAvailable);
    expect(onAvailable).toHaveBeenCalledWith(true);

    const lostEvent = new Event("webglcontextlost", { cancelable: true });
    canvas.dispatchEvent(lostEvent);
    expect(onAvailable).toHaveBeenLastCalledWith(false);

    canvas.dispatchEvent(new Event("webglcontextrestored"));
    expect(onAvailable).toHaveBeenLastCalledWith(true);

    controller.dispose();
  });
});
