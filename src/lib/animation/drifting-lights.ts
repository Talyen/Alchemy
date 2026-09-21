import type { BackgroundLightsSettings } from "../screen-effect-settings";
import { logError } from "../error-logger";
import { createCanvasLifecycle } from "./canvas-lifecycle";
import { createWebGLProgram } from "./webgl-program";

type LightSettings = Pick<BackgroundLightsSettings, "strength" | "motion">;

const VERTEX = `
attribute vec2 aPosition;
void main() { gl_Position = vec4(aPosition, 0.0, 1.0); }
`;
const FRAGMENT = `
precision highp float;
uniform vec2 uSize;
uniform float uTime;
uniform float uStrength;
uniform float uSpeed;

vec2 drift(float time) {
  float phase = fract(time) * 3.0;
  float eased = smoothstep(0.0, 1.0, fract(phase));
  if (phase < 1.0) return mix(vec2(-0.10, -0.06), vec2(0.10, -0.03), eased);
  if (phase < 2.0) return mix(vec2(0.10, -0.03), vec2(0.02, 0.10), eased);
  return mix(vec2(0.02, 0.10), vec2(-0.10, -0.06), eased);
}
float glow(vec2 uv, vec2 center, float extent) {
  vec2 radius = max(center, 1.0 - center) * 1.41421356 * extent;
  return max(0.0, 1.0 - length((uv - center) / radius));
}
vec4 over(vec3 color, float alpha, vec4 under) {
  return vec4(color * alpha, alpha) + under * (1.0 - alpha);
}
void main() {
  vec2 pixel = vec2(gl_FragCoord.x, uSize.y - gl_FragCoord.y);
  vec2 uv = (pixel / uSize + 0.2) / 1.4;
  vec2 a = uv;
  vec2 b = uv;
  if (uSpeed > 0.0) {
    a -= drift(uTime * uSpeed / 24.0);
    b -= drift(1.0 - (uTime * uSpeed + 12.0) / 31.0);
  }
  vec4 light = vec4(0.0);
  light = over(vec3(255.0, 226.0, 154.0) / 255.0, glow(a, vec2(0.65, 0.60), 0.45) * 0.12, light);
  light = over(vec3(109.0, 210.0, 189.0) / 255.0, glow(a, vec2(0.38, 0.42), 0.48) * 0.19, light);
  light = over(vec3(173.0, 124.0, 240.0) / 255.0, glow(b, vec2(0.58, 0.46), 0.52) * 0.19, light);
  light *= uStrength;

  // Stochastic rounding at the final 8-bit output, after intensity and premultiplication.
  // One screen-anchored threshold for RGBA preserves rgb <= alpha. No moving noise mask.
  float threshold = fract(52.9829189 * fract(dot(pixel, vec2(0.06711056, 0.00583715))));
  gl_FragColor = floor(light * 255.0 + threshold) / 255.0;
}
`;

export function startDriftingLights(
  canvas: HTMLCanvasElement,
  onAvailable: (available: boolean) => void,
): {
  update: (settings: LightSettings) => void;
  dispose: () => void;
} {
  let settings: LightSettings = { strength: 0, motion: "still" };
  let elapsed = 0;
  let resource: { draw: () => void; wake: () => void; dispose: () => void } | null = null;
  let disposed = false;

  function start() {
    let gl: WebGLRenderingContext | null = null;
    try {
      gl = canvas.getContext("webgl", {
        alpha: true,
        premultipliedAlpha: true,
        antialias: false,
        depth: false,
        stencil: false,
      });
    } catch {
      /* Availability fallback also handles context creation exceptions. */
    }
    if (!gl) return null;
    const context = gl;
    const program = createWebGLProgram(context, VERTEX, FRAGMENT);
    if (!program) return null;
    const position = context.getAttribLocation(program, "aPosition");
    const size = context.getUniformLocation(program, "uSize");
    const time = context.getUniformLocation(program, "uTime");
    const strength = context.getUniformLocation(program, "uStrength");
    const speed = context.getUniformLocation(program, "uSpeed");
    const buffer = context.createBuffer();
    if (!buffer || position < 0 || !size || !time || !strength || !speed) {
      if (buffer) context.deleteBuffer(buffer);
      context.deleteProgram(program);
      return null;
    }
    context.useProgram(program);
    context.bindBuffer(context.ARRAY_BUFFER, buffer);
    context.bufferData(context.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), context.STATIC_DRAW);
    context.enableVertexAttribArray(position);
    context.vertexAttribPointer(position, 2, context.FLOAT, false, 0, 0);
    context.disable(context.BLEND);
    context.disable(context.DITHER);
    const draw = () => {
      if (canvas.width < 2 || canvas.height < 2 || context.isContextLost()) return;
      context.viewport(0, 0, canvas.width, canvas.height);
      context.uniform2f(size, canvas.width, canvas.height);
      context.uniform1f(time, elapsed);
      context.uniform1f(strength, settings.strength / 100);
      context.uniform1f(speed, settings.motion === "still" ? 0 : settings.motion === "flowing" ? 2 : 1);
      context.drawArrays(context.TRIANGLES, 0, 3);
    };
    const lifecycle = createCanvasLifecycle({
      canvas,
      active: () => settings.motion !== "still" && settings.strength > 0,
      // Retain pixel-scale dither through normal desktop sizes, with a 4K pixel budget.
      backingScale: { scaleMultiplier: 1, maxScale: 2, maxPixels: 8_294_400 },
      onResize: draw,
      onFrame: (_now, dt) => {
        elapsed += (dt * 16.67) / 1000;
        draw();
      },
    });
    return {
      draw,
      wake: lifecycle.scheduleFrame,
      dispose: () => {
        lifecycle.dispose();
        context.deleteBuffer(buffer);
        context.deleteProgram(program);
      },
    };
  }
  function initialize() {
    if (disposed) return;
    resource = start();
    onAvailable(resource !== null);
    if (!resource) logError("Drifting lights WebGL unavailable; using static decoration", "other");
  }
  function lost(event: Event) {
    event.preventDefault();
    resource?.dispose();
    resource = null;
    onAvailable(false);
    logError("Drifting lights WebGL context lost; using static decoration", "other");
  }
  function restored() {
    initialize();
  }
  canvas.addEventListener("webglcontextlost", lost);
  canvas.addEventListener("webglcontextrestored", restored);
  initialize();
  return {
    update: (next) => {
      settings = next;
      resource?.draw();
      resource?.wake();
    },
    dispose: () => {
      disposed = true;
      canvas.removeEventListener("webglcontextlost", lost);
      canvas.removeEventListener("webglcontextrestored", restored);
      resource?.dispose();
      resource = null;
    },
  };
}
