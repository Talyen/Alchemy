import { sliceCrackPointAtFraction, SLICE_CARD_FRACTION_RANGE } from "./slice-crack";
import {
  sampleBorderSpark,
  sampleCutSpark,
  SLICE_CUT_SPARK_COLOR,
  SLICE_CUT_PARTICLES,
  SLICE_LEFT_BORDER_PARTICLES,
  SLICE_RIGHT_BORDER_PARTICLES,
  SLICE_SPARK_COLOR,
  type SliceBorderParticle,
} from "./slice-particles";
import type { SliceOffset, SliceVisual } from "./slice-timeline";

function drawCutEdge(
  ctx: CanvasRenderingContext2D,
  visual: SliceVisual,
  width: number,
  height: number,
  originX: number,
  originY: number,
  primary: boolean,
): void {
  if (visual.edgeOpacity <= 0 || visual.crackDraw <= SLICE_CARD_FRACTION_RANGE.start) return;
  const sign = primary ? -1 : 1;
  const offset = primary ? visual.leftOffset : visual.rightOffset;
  const a = sliceCrackPointAtFraction(SLICE_CARD_FRACTION_RANGE.start);
  const b = sliceCrackPointAtFraction(Math.min(visual.crackDraw, SLICE_CARD_FRACTION_RANGE.end));
  const dx = (b.x - a.x) * width;
  const dy = (b.y - a.y) * height;
  const length = Math.hypot(dx, dy);
  const nx = dy / length;
  const ny = -dx / length;
  const scale = width / 256;

  ctx.save();
  // Match the portrait's center-origin transform, then clip shading to its bounds.
  ctx.translate(originX + width / 2 + offset.x, originY + height / 2 + offset.y);
  ctx.rotate((sign * visual.twistDeg * Math.PI) / 180);
  ctx.translate(-width / 2, -height / 2);
  ctx.beginPath();
  ctx.rect(0, 0, width, height);
  ctx.clip();
  ctx.lineCap = "butt";
  for (const [inset, thickness, color, opacity] of [
    [1.5, 3, "rgb(12, 8, 7)", 0.75],
    [0.45, 0.9, "rgb(255, 220, 172)", primary ? 0.6 : 0.3],
  ] as const) {
    ctx.globalAlpha = visual.edgeOpacity * opacity;
    ctx.strokeStyle = color;
    ctx.lineWidth = thickness * scale;
    ctx.beginPath();
    ctx.moveTo(a.x * width + nx * sign * inset * scale, a.y * height + ny * sign * inset * scale);
    ctx.lineTo(b.x * width + nx * sign * inset * scale, b.y * height + ny * sign * inset * scale);
    ctx.stroke();
  }
  ctx.restore();
}

function drawBladeFlash(
  ctx: CanvasRenderingContext2D,
  visual: SliceVisual,
  width: number,
  height: number,
  originX: number,
  originY: number,
): void {
  if (visual.flashOpacity <= 0 || visual.crackDraw <= 0) return;
  const tail = sliceCrackPointAtFraction(Math.max(0, visual.crackDraw - 0.8));
  const tip = sliceCrackPointAtFraction(visual.crackDraw);
  const ax = originX + tail.x * width;
  const ay = originY + tail.y * height;
  const bx = originX + tip.x * width;
  const by = originY + tip.y * height;
  const length = Math.hypot(bx - ax, by - ay);
  if (length <= 0) return;
  const nx = (by - ay) / length;
  const ny = -(bx - ax) / length;
  const mx = ax + (bx - ax) * 0.65;
  const my = ay + (by - ay) * 0.65;
  ctx.save();
  for (const [breadth, color, opacity] of [
    [8, "rgb(255, 183, 95)", 0.12],
    [3.5, "rgb(255, 221, 172)", 0.4],
    [1.3, "rgb(255, 253, 245)", 1],
  ] as const) {
    const radius = breadth * (width / 256);
    ctx.globalAlpha = visual.flashOpacity * opacity;
    ctx.fillStyle = color;
    ctx.shadowColor = "rgb(255, 183, 95)";
    ctx.shadowBlur = breadth === 8 ? radius : 0;
    ctx.beginPath();
    ctx.moveTo(ax, ay);
    ctx.quadraticCurveTo(mx + nx * radius, my + ny * radius, bx, by);
    ctx.quadraticCurveTo(mx - nx * radius, my - ny * radius, ax, ay);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();
}

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
    const sample = sampleBorderSpark(particle, dissolve, cardWidth, cardHeight);
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

  drawCutEdge(ctx, visual, cardWidth, cardHeight, originX, originY, true);
  drawCutEdge(ctx, visual, cardWidth, cardHeight, originX, originY, false);
  drawBladeFlash(ctx, visual, cardWidth, cardHeight, originX, originY);

  ctx.fillStyle = SLICE_CUT_SPARK_COLOR;
  for (const particle of SLICE_CUT_PARTICLES) {
    const sample = sampleCutSpark(particle, visual.sparkT, cardWidth, cardHeight);
    if (!sample) continue;
    ctx.globalAlpha = sample.opacity;
    ctx.strokeStyle = SLICE_CUT_SPARK_COLOR;
    ctx.lineCap = "butt";
    const diameter = sample.diameter * (cardWidth / 256);
    ctx.lineWidth = diameter;
    ctx.beginPath();
    ctx.moveTo(originX + sample.x, originY + sample.y);
    ctx.lineTo(
      originX + sample.x - particle.sprayDir.dx * diameter * 4,
      originY + sample.y - particle.sprayDir.dy * diameter * 4,
    );
    ctx.stroke();
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
