import { traceSliceCrackPath } from "./slice-crack";
import {
  sampleBorderSpark,
  sampleCutSpark,
  SLICE_CRACK_LINE_COLOR,
  SLICE_CUT_PARTICLES,
  SLICE_LEFT_BORDER_PARTICLES,
  SLICE_RIGHT_BORDER_PARTICLES,
  SLICE_SPARK_COLOR,
  type SliceBorderParticle,
  type SliceSparkSample,
} from "./slice-particles";
import type { SliceOffset, SliceVisual } from "./slice-timeline";

function fillSpark(ctx: CanvasRenderingContext2D, x: number, y: number, diameter: number, opacity: number): void {
  ctx.globalAlpha = opacity;
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
  scratch: SliceSparkSample,
): void {
  if (dissolve <= 0.001) return;
  const cx = cardWidth / 2;
  const cy = cardHeight / 2;
  const radians = (twistDeg * Math.PI) / 180;
  const cos = Math.cos(radians);
  const sin = Math.sin(radians);
  // fillSpark relies on the caller's fillStyle; set it here so border sparks
  // stay correct even if draw ordering changes above.
  ctx.fillStyle = SLICE_SPARK_COLOR;
  for (const particle of particles) {
    const sample = sampleBorderSpark(particle, dissolve, cardWidth, cardHeight, scratch);
    if (!sample) continue;
    const dx = sample.x - cx;
    const dy = sample.y - cy;
    const rx = cx + dx * cos - dy * sin;
    const ry = cy + dx * sin + dy * cos;
    fillSpark(ctx, originX + rx + offset.x, originY + ry + offset.y, sample.diameter, sample.opacity);
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
  // Samples are consumed immediately; one frame-local object serves every
  // spark without retaining mutable state across canvases or frames.
  const scratch: SliceSparkSample = { x: 0, y: 0, diameter: 0, opacity: 0 };

  if (visual.lineOpacity > 0.02 && visual.crackDraw > 0) {
    ctx.globalAlpha = visual.lineOpacity * 0.95;
    ctx.strokeStyle = SLICE_CRACK_LINE_COLOR;
    ctx.lineWidth = 2.6 * Math.max(visual.lineOpacity, 0.35);
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.beginPath();
    const tip = traceSliceCrackPath(ctx, visual.crackDraw, cardWidth, cardHeight, originX, originY);
    if (tip) {
      ctx.stroke();
      const tipRadius = 2.2 * Math.max(visual.lineOpacity, 0.35);
      ctx.globalAlpha = visual.lineOpacity;
      ctx.fillStyle = SLICE_CRACK_LINE_COLOR;
      ctx.beginPath();
      ctx.arc(tip.tipX, tip.tipY, tipRadius, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  ctx.fillStyle = SLICE_SPARK_COLOR;
  for (const particle of SLICE_CUT_PARTICLES) {
    const sample = sampleCutSpark(particle, visual.crackT, cardWidth, cardHeight, scratch);
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
    scratch,
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
    scratch,
  );

  ctx.globalAlpha = 1;
}
