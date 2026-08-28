import { parsePlasmaHexColor } from "@/lib/animation/plasma-colors";
import { startCanvasKeywordPlasma } from "./keyword-plasma-canvas";
import { createPlasmaLifecycle } from "./keyword-plasma-lifecycle";
import type { PlasmaRendererOptions } from "./keyword-plasma-types";

const VERTEX_SHADER = `
attribute vec2 aPosition;
void main() {
  gl_Position = vec4(aPosition, 0.0, 1.0);
}
`;

const FRAGMENT_SHADER = `
precision highp float;

uniform vec2 uSize;
uniform float uTime;
uniform vec3 uPrimary;
uniform vec3 uSecondary;
uniform vec2 uFocalCenter;

// Triangular-distribution dither: two uniform samples averaged remove banding
// while keeping the noise floor low (tent PDF vs harsh uniform).
float triDither(vec2 seed) {
  float r1 = fract(sin(dot(seed, vec2(12.9898, 78.233))) * 43758.5453);
  float r2 = fract(sin(dot(seed + 0.5, vec2(93.9898, 67.345))) * 31415.9265);
  return (r1 + r2 - 1.0) / 255.0;
}

void main() {
  vec2 position = vec2(gl_FragCoord.x, uSize.y - gl_FragCoord.y);
  vec2 uv = (position - uFocalCenter) / min(uSize.x, uSize.y);
  float dist = length(uv);
  float ht = uTime;

  vec2 c1 = vec2(sin(ht * 0.30) * 0.60, cos(ht * 0.36) * 0.55);
  vec2 c2 = vec2(-c1.x, c1.y);
  vec2 c3 = vec2(cos(ht * 0.24 + 1.2) * 0.50, sin(ht * 0.32 + 0.8) * 0.45);
  vec2 c4 = vec2(-c3.x, c3.y);

  vec2 d1 = uv - c1;
  vec2 d2 = uv - c2;
  vec2 d3 = uv - c3;
  vec2 d4 = uv - c4;

  float f1 = 1.0 / (1.0 + dot(d1, d1) * 2.2);
  float f2 = 1.0 / (1.0 + dot(d2, d2) * 2.2);
  float f3 = 1.0 / (1.0 + dot(d3, d3) * 2.2);
  float f4 = 1.0 / (1.0 + dot(d4, d4) * 2.2);

  float field = (f1 + f2 + f3 + f4) * 0.25;
  float wave = cos(abs(uv.x) * 2.5 + ht * 0.12) * cos(uv.y * 2.0 - ht * 0.15) * 0.08;
  float fluid = clamp(field + wave, 0.0, 1.0);
  float smoothFluid = fluid * fluid * (3.0 - 2.0 * fluid);
  float radialFalloff = 1.0 / (1.0 + dist * dist * 1.4);

  vec3 color = mix(uPrimary, uSecondary, clamp(smoothFluid * 1.2, 0.0, 1.0));
  float alpha = clamp(smoothFluid * radialFalloff * 0.13 + triDither(position), 0.0, 0.14);

  gl_FragColor = vec4(color * alpha, alpha);
}
`;

function compileShader(gl: WebGLRenderingContext, type: number, source: string): WebGLShader | null {
  const shader = gl.createShader(type);
  if (!shader) return null;
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    gl.deleteShader(shader);
    return null;
  }
  return shader;
}

function createProgram(gl: WebGLRenderingContext): WebGLProgram | null {
  const vertex = compileShader(gl, gl.VERTEX_SHADER, VERTEX_SHADER);
  const fragment = compileShader(gl, gl.FRAGMENT_SHADER, FRAGMENT_SHADER);
  if (!vertex || !fragment) return null;

  const program = gl.createProgram();
  if (!program) return null;
  gl.attachShader(program, vertex);
  gl.attachShader(program, fragment);
  gl.linkProgram(program);
  gl.deleteShader(vertex);
  gl.deleteShader(fragment);

  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    gl.deleteProgram(program);
    return null;
  }
  return program;
}

export function startWebGLKeywordPlasma(options: PlasmaRendererOptions): () => void {
  const { canvas, colorsRef, focalYOffset, active, onWakeReady } = options;
  const gl = canvas.getContext("webgl", { alpha: true, premultipliedAlpha: true, antialias: false });
  if (!gl) return startCanvasKeywordPlasma(options);

  const program = createProgram(gl);
  if (!program) return startCanvasKeywordPlasma(options);

  const positionLoc = gl.getAttribLocation(program, "aPosition");
  const sizeLoc = gl.getUniformLocation(program, "uSize");
  const timeLoc = gl.getUniformLocation(program, "uTime");
  const primaryLoc = gl.getUniformLocation(program, "uPrimary");
  const secondaryLoc = gl.getUniformLocation(program, "uSecondary");
  const focalLoc = gl.getUniformLocation(program, "uFocalCenter");

  const buffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);

  gl.enableVertexAttribArray(positionLoc);
  gl.vertexAttribPointer(positionLoc, 2, gl.FLOAT, false, 0, 0);
  gl.useProgram(program);
  gl.enable(gl.BLEND);
  gl.blendFunc(gl.ONE, gl.ONE);
  let cachedPrimaryHex = "";
  let cachedSecondaryHex = "";
  let cachedPrimary: [number, number, number] = [0, 0, 0];
  let cachedSecondary: [number, number, number] = [0, 0, 0];

  const lifecycle = createPlasmaLifecycle({
    canvas,
    active,
    onFrame: (time, width, height) => {
      if (width <= 0 || height <= 0) return;

      gl.viewport(0, 0, canvas.width, canvas.height);
      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT);

      if (cachedPrimaryHex !== colorsRef.current.primary) {
        cachedPrimaryHex = colorsRef.current.primary;
        cachedPrimary = parsePlasmaHexColor(cachedPrimaryHex);
      }
      if (cachedSecondaryHex !== colorsRef.current.secondary) {
        cachedSecondaryHex = colorsRef.current.secondary;
        cachedSecondary = parsePlasmaHexColor(cachedSecondaryHex);
      }
      const primary = cachedPrimary;
      const secondary = cachedSecondary;

      const backingScale = height > 0 ? canvas.height / height : 1;
      gl.uniform2f(sizeLoc, canvas.width, canvas.height);
      gl.uniform1f(timeLoc, time);
      gl.uniform3f(primaryLoc, primary[0], primary[1], primary[2]);
      gl.uniform3f(secondaryLoc, secondary[0], secondary[1], secondary[2]);
      gl.uniform2f(focalLoc, canvas.width / 2, canvas.height / 2 - focalYOffset * backingScale);

      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    },
  });
  onWakeReady?.(lifecycle.scheduleFrame);

  return () => {
    onWakeReady?.(() => {});
    lifecycle.dispose();
    gl.deleteBuffer(buffer);
    gl.deleteProgram(program);
  };
}
