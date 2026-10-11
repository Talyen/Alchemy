import { createWebGLProgram } from "./webgl-program";
import { parsePlasmaHexColor, type RgbTuple } from "@/lib/animation/plasma-colors";
import { createCanvasLifecycle, resolveCanvasBackingScale } from "./canvas-lifecycle";
import { PLASMA_BACKING_OPTIONS, type PlasmaRendererOptions } from "./keyword-plasma-types";

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
uniform vec2 uFocalCenter;

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

  // Store the broad field before applying the low-opacity colors. Quantizing
  // premultiplied glow here would bake bands into the enlarged texture.
  gl_FragColor = vec4(smoothFluid, radialFalloff, 0.0, 1.0);
}
`;

const COMPOSITE_SHADER = `
precision highp float;
uniform sampler2D uField;
uniform vec2 uOutputSize;
uniform vec3 uPrimary;
uniform vec3 uSecondary;

void main() {
  vec2 field = texture2D(uField, gl_FragCoord.xy / uOutputSize).rg;
  vec3 color = mix(uPrimary, uSecondary, clamp(field.r * 1.2, 0.0, 1.0));
  float alpha = field.r * field.g * 0.13;
  // Stable screen-space stochastic rounding breaks up RGB quantization without
  // animated grain. Apply it after premultiplication, at the output resolution.
  float noise = fract(52.9829189 * fract(dot(gl_FragCoord.xy, vec2(0.06711056, 0.00583715))));
  vec3 rgb = floor(color * alpha * 255.0 + noise) / 255.0;
  // Round alpha up so every rounded RGB channel remains valid premultiplied RGB.
  gl_FragColor = vec4(rgb, ceil(alpha * 255.0) / 255.0);
}
`;

function tryGetWebGLContext(canvas: HTMLCanvasElement): WebGLRenderingContext | null {
  try {
    return canvas.getContext("webgl", {
      alpha: true,
      premultipliedAlpha: true,
      antialias: false,
      depth: false,
      stencil: false,
    });
  } catch {
    return null;
  }
}

export function startWebGLKeywordPlasma(options: PlasmaRendererOptions): (() => void) | null {
  const { canvas, colorsRef, focalYOffset, active, onWakeReady } = options;
  const gl = tryGetWebGLContext(canvas);
  if (!gl) return null;

  const program = createWebGLProgram(gl, VERTEX_SHADER, FRAGMENT_SHADER);
  if (!program) return null;

  const composite = createWebGLProgram(gl, VERTEX_SHADER, COMPOSITE_SHADER);
  if (!composite) {
    gl.deleteProgram(program);
    return null;
  }
  const buffer = gl.createBuffer();
  const texture = gl.createTexture();
  const framebuffer = gl.createFramebuffer();
  const disposeResources = () => {
    if (buffer) gl.deleteBuffer(buffer);
    if (texture) gl.deleteTexture(texture);
    if (framebuffer) gl.deleteFramebuffer(framebuffer);
    gl.deleteProgram(program);
    gl.deleteProgram(composite);
  };
  const positionLoc = gl.getAttribLocation(program, "aPosition");
  const compositePositionLoc = gl.getAttribLocation(composite, "aPosition");
  const sizeLoc = gl.getUniformLocation(program, "uSize");
  const timeLoc = gl.getUniformLocation(program, "uTime");
  const focalLoc = gl.getUniformLocation(program, "uFocalCenter");
  const outputSizeLoc = gl.getUniformLocation(composite, "uOutputSize");
  const fieldLoc = gl.getUniformLocation(composite, "uField");
  const primaryLoc = gl.getUniformLocation(composite, "uPrimary");
  const secondaryLoc = gl.getUniformLocation(composite, "uSecondary");
  if (
    !buffer ||
    !texture ||
    !framebuffer ||
    positionLoc < 0 ||
    compositePositionLoc < 0 ||
    !sizeLoc ||
    !timeLoc ||
    !focalLoc ||
    !outputSizeLoc ||
    !fieldLoc ||
    !primaryLoc ||
    !secondaryLoc
  ) {
    disposeResources();
    return null;
  }
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
  const usePass = (pass: WebGLProgram, position: number) => {
    gl.useProgram(pass);
    gl.enableVertexAttribArray(position);
    gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0);
  };
  gl.activeTexture(gl.TEXTURE0);
  gl.bindTexture(gl.TEXTURE_2D, texture);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer);
  gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, texture, 0);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
  if (gl.checkFramebufferStatus(gl.FRAMEBUFFER) !== gl.FRAMEBUFFER_COMPLETE) {
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    disposeResources();
    return null;
  }
  usePass(composite, compositePositionLoc);
  gl.uniform1i(fieldLoc, 0);
  // Each pass overwrites its entire target; no clear or destination blend needed.
  gl.disable(gl.BLEND);
  gl.disable(gl.DITHER);
  let fieldWidth = 1;
  let fieldHeight = 1;
  let framebufferReady = true;
  let cachedPrimarySource: string | RgbTuple | null = null;
  let cachedSecondarySource: string | RgbTuple | null = null;
  let cachedPrimary: RgbTuple = [0, 0, 0];
  let cachedSecondary: RgbTuple = [0, 0, 0];
  const uploadedPrimary: [number, number, number] = [NaN, NaN, NaN];
  const uploadedSecondary: [number, number, number] = [NaN, NaN, NaN];

  const uploadColor = (location: WebGLUniformLocation, color: RgbTuple, uploaded: [number, number, number]): void => {
    if (color[0] === uploaded[0] && color[1] === uploaded[1] && color[2] === uploaded[2]) return;
    gl.uniform3f(location, color[0], color[1], color[2]);
    uploaded[0] = color[0];
    uploaded[1] = color[1];
    uploaded[2] = color[2];
  };

  const startTime = performance.now();
  const lifecycle = createCanvasLifecycle({
    canvas,
    active: () => framebufferReady && active(),
    fpsLimit: 30,
    // Keep the field cheap; only the texture lookup and dither run at display
    // resolution. Bound extreme DPR/window sizes to a 4K-class allocation.
    backingScale: { maxScale: 2, maxPixels: 8_294_400 },
    onResize: (width, height) => {
      const scale = resolveCanvasBackingScale(width, height, PLASMA_BACKING_OPTIONS);
      fieldWidth = Math.max(1, Math.floor(width * scale));
      fieldHeight = Math.max(1, Math.floor(height * scale));
      gl.bindTexture(gl.TEXTURE_2D, texture);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, fieldWidth, fieldHeight, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
      gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer);
      const wasReady = framebufferReady;
      framebufferReady = gl.checkFramebufferStatus(gl.FRAMEBUFFER) === gl.FRAMEBUFFER_COMPLETE;
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      if (framebufferReady !== wasReady) options.onAvailabilityChange?.(framebufferReady);
      usePass(program, positionLoc);
      gl.uniform2f(sizeLoc, fieldWidth, fieldHeight);
      gl.uniform2f(focalLoc, fieldWidth / 2, fieldHeight / 2 - focalYOffset * (height > 0 ? fieldHeight / height : 1));
      usePass(composite, compositePositionLoc);
      gl.uniform2f(outputSizeLoc, canvas.width, canvas.height);
    },
    onFrame: (now, _dt, width, height) => {
      if (width <= 0 || height <= 0) return;

      if (cachedPrimarySource !== colorsRef.current.primary) {
        cachedPrimarySource = colorsRef.current.primary;
        cachedPrimary =
          typeof cachedPrimarySource === "string" ? parsePlasmaHexColor(cachedPrimarySource) : cachedPrimarySource;
      }
      if (cachedSecondarySource !== colorsRef.current.secondary) {
        cachedSecondarySource = colorsRef.current.secondary;
        cachedSecondary =
          typeof cachedSecondarySource === "string"
            ? parsePlasmaHexColor(cachedSecondarySource)
            : cachedSecondarySource;
      }
      const primary = cachedPrimary;
      const secondary = cachedSecondary;

      gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer);
      gl.viewport(0, 0, fieldWidth, fieldHeight);
      usePass(program, positionLoc);
      // Do not sample a texture while it is attached to the current framebuffer.
      gl.bindTexture(gl.TEXTURE_2D, null);
      gl.uniform1f(timeLoc, (now - startTime) / 1000);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      gl.viewport(0, 0, canvas.width, canvas.height);
      usePass(composite, compositePositionLoc);
      gl.bindTexture(gl.TEXTURE_2D, texture);
      // Uniforms survive draws and backing resizes. Compare channels so an
      // interpolated or in-place updated tuple still uploads its exact values.
      uploadColor(primaryLoc, primary, uploadedPrimary);
      uploadColor(secondaryLoc, secondary, uploadedSecondary);

      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    },
  });
  if (!framebufferReady) {
    lifecycle.dispose();
    disposeResources();
    return null;
  }
  onWakeReady?.(lifecycle.scheduleFrame);

  return () => {
    onWakeReady?.(() => {});
    lifecycle.dispose();
    disposeResources();
  };
}
