import { sliceCrackPolylineToFraction } from "./slice-crack";
import {
  sampleBorderSpark,
  sampleCutSpark,
  SLICE_CRACK_LINE_COLOR,
  SLICE_CUT_PARTICLES,
  SLICE_LEFT_BORDER_PARTICLES,
  SLICE_RIGHT_BORDER_PARTICLES,
  SLICE_SPARK_COLOR,
  type SliceBorderParticle,
} from "./slice-particles";
import type { SliceOffset, SliceVisual } from "./slice-timeline";

function rotateAround(x: number, y: number, cx: number, cy: number, degrees: number): { x: number; y: number } {
  const radians = (degrees * Math.PI) / 180;
  const cos = Math.cos(radians);
  const sin = Math.sin(radians);
  const dx = x - cx;
  const dy = y - cy;
  return { x: cx + dx * cos - dy * sin, y: cy + dx * sin + dy * cos };
}

function fillSpark(ctx: CanvasRenderingContext2D, x: number, y: number, diameter: number, opacity: number): void {
  ctx.globalAlpha = opacity;
  ctx.fillStyle = SLICE_SPARK_COLOR;
  ctx.beginPath();
  ctx.arc(x, y, diameter / 2, 0, Math.PI * 2);
  ctx.fill();
}

function drawBorderSparks(
  ctx: CanvasRenderingContext2D,
  particles: readonly SliceBorderParticle[],
  dissolve: number,
  cardWidth: number,
  cardHeight: number,
  originX: number,
  originY: number,
  offset: SliceOffset,
  twistDeg: number,
): void {
  if (dissolve <= 0.001) return;
  const cx = cardWidth / 2;
  const cy = cardHeight / 2;
  for (const particle of particles) {
    const sample = sampleBorderSpark(particle, dissolve, cardWidth, cardHeight);
    if (!sample) continue;
    const rotated = rotateAround(sample.x, sample.y, cx, cy, twistDeg);
    fillSpark(ctx, originX + rotated.x + offset.x, originY + rotated.y + offset.y, sample.diameter, sample.opacity);
  }
}

export function drawSliceFrame(
  ctx: CanvasRenderingContext2D,
  visual: SliceVisual,
  cardWidth: number,
  cardHeight: number,
  originX: number,
  originY: number,
): void {
  ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);

  if (visual.lineOpacity > 0.02 && visual.crackDraw > 0) {
    const pixels = sliceCrackPolylineToFraction(visual.crackDraw, cardWidth, cardHeight);
    const tip = pixels[pixels.length - 1]!;
    ctx.globalAlpha = visual.lineOpacity * 0.95;
    ctx.strokeStyle = SLICE_CRACK_LINE_COLOR;
    ctx.lineWidth = 2.6 * Math.max(visual.lineOpacity, 0.35);
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.beginPath();
    ctx.moveTo(originX + pixels[0]!.x, originY + pixels[0]!.y);
    for (let i = 1; i < pixels.length; i++) {
      ctx.lineTo(originX + pixels[i]!.x, originY + pixels[i]!.y);
    }
    ctx.stroke();
    const tipRadius = 2.2 * Math.max(visual.lineOpacity, 0.35);
    ctx.globalAlpha = visual.lineOpacity;
    ctx.fillStyle = SLICE_CRACK_LINE_COLOR;
    ctx.beginPath();
    ctx.arc(originX + tip.x, originY + tip.y, tipRadius, 0, Math.PI * 2);
    ctx.fill();
  }

  for (const particle of SLICE_CUT_PARTICLES) {
    const sample = sampleCutSpark(particle, visual.crackT, cardWidth, cardHeight);
    if (!sample) continue;
    fillSpark(ctx, originX + sample.x, originY + sample.y, sample.diameter, sample.opacity);
  }

  drawBorderSparks(
    ctx,
    SLICE_LEFT_BORDER_PARTICLES,
    visual.dissolve,
    cardWidth,
    cardHeight,
    originX,
    originY,
    visual.leftOffset,
    -visual.twistDeg,
  );
  drawBorderSparks(
    ctx,
    SLICE_RIGHT_BORDER_PARTICLES,
    visual.dissolve,
    cardWidth,
    cardHeight,
    originX,
    originY,
    visual.rightOffset,
    visual.twistDeg,
  );

  ctx.globalAlpha = 1;
}
