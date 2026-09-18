import fs from "node:fs/promises";
import { Buffer } from "node:buffer";
import console from "node:console";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const directory = path.dirname(fileURLToPath(import.meta.url));
const masterPath = path.join(directory, "card-back.png");
const spentMasterPath = path.join(directory, "discard-back.png");
const deckPath = path.join(directory, "deck-pile.png");
const discardPath = path.join(directory, "discard-pile.png");

const activeBytes = await fs.readFile(masterPath);
const spentBytes = await fs.readFile(spentMasterPath);
const transparent = { r: 0, g: 0, b: 0, alpha: 0 };

const activeResized = await sharp(activeBytes).resize(864, 1152, { fit: "fill" }).toBuffer();
const spentResized = await sharp(spentBytes).resize(864, 1152, { fit: "fill" }).toBuffer();

// 1. Draw pile (leaning left for bottom-left HUD)
const drawLayers = [];
for (let index = 0; index < 6; index += 1) {
  const face = await sharp(activeResized)
    .modulate({ brightness: index === 5 ? 1 : 0.7 + index * 0.05 })
    .rotate(-2.5, { background: transparent })
    .png()
    .toBuffer();
  drawLayers.push({ input: face, left: 40 + index * 22, top: 210 - index * 30 });
}

await sharp({ create: { width: 1086, height: 1448, channels: 4, background: transparent } })
  .composite(drawLayers)
  .png()
  .toFile(deckPath);

// 2. Discard pile (leaning right for bottom-right HUD, spent layers)
const discardLayers = [];
for (let index = 0; index < 6; index += 1) {
  const isTop = index === 5;
  const angle = 2.5 + (index % 2 === 0 ? 0.8 : -0.5);
  const face = await sharp(spentResized)
    .modulate({ brightness: isTop ? 1.0 : 0.65 + index * 0.05 })
    .rotate(angle, { background: transparent })
    .png()
    .toBuffer();
  discardLayers.push({ input: face, left: 160 - index * 22, top: 210 - index * 30 });
}

await sharp({ create: { width: 1086, height: 1448, channels: 4, background: transparent } })
  .composite(discardLayers)
  .png()
  .toFile(discardPath);

for (const file of [deckPath, discardPath]) {
  const metadata = await sharp(file).metadata();
  const stats = await sharp(file).stats();
  if (metadata.width * 4 !== metadata.height * 3 || !metadata.hasAlpha || stats.channels[3].min !== 0) {
    throw new Error("Pile must be 3:4 with genuine transparency");
  }
}

// 3. HUD comparison image
let svg =
  '<svg width="1050" height="850"><rect width="1050" height="850" fill="#101722"/><style>text{font-family:system-ui,sans-serif;fill:#e7edf5}</style>';
const previewLayers = [];
const label = (text, x, y, size = 16, weight = "normal", fill = "#e7edf5") => {
  svg += `<text x="${x}" y="${y}" font-size="${size}" font-weight="${weight}" fill="${fill}">${text}</text>`;
};
const add = async (file, width, height, left, top) => {
  previewLayers.push({ input: await sharp(file).resize(width, height).png().toBuffer(), left, top });
};

label("TRAVELER COMPASS — CARD REDESIGN AND PILES", 30, 40, 22, "bold", "#fde047");
label("Draw Pile (Bottom-Left)", 60, 85, 17, "bold");
label("Single Card Back (Active)", 410, 85, 17, "bold");
label("Discard Pile (Bottom-Right)", 740, 85, 17, "bold");

await add(deckPath, 280, 373, 50, 105);
await add(masterPath, 240, 320, 405, 130);
await add(discardPath, 280, 373, 720, 105);

label("In-Game Battle HUD Scale (161 x 215 px)", 30, 520, 18, "bold", "#38bdf8");
svg += '<rect x="20" y="540" width="1010" height="260" rx="12" fill="#181f2b" stroke="#394558" stroke-width="2"/>';

await add(deckPath, 161, 215, 45, 560);
label("DRAW PILE (Deck)", 75, 785, 13, "bold", "#fb923c");

await add(masterPath, 90, 120, 480, 600);
label("Transfer Card", 485, 735, 12, "normal", "#94a3b8");

await add(discardPath, 161, 215, 844, 560);
label("DISCARD PILE (Spent)", 860, 785, 13, "bold", "#a78bfa");

label(
  "Features: Smooth rounded corners · 8 Keyword color pips · Distinct spent discard state · Transparent PNGs",
  30,
  830,
  13,
  "normal",
  "#94a3b8",
);
svg += "</svg>";

await sharp(Buffer.from(svg)).composite(previewLayers).png().toFile(path.join(directory, "comparison.png"));

console.log("Successfully built deck-pile, discard-pile, and comparison image.");
