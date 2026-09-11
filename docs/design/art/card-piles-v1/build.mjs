import fs from "node:fs/promises";
import { Buffer } from "node:buffer";
import console from "node:console";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const directory = path.dirname(fileURLToPath(import.meta.url));
const masterPath = path.join(directory, "../approved-art/card-back.png");
const originalBytes = await fs.readFile(masterPath);
const transparent = { r: 0, g: 0, b: 0, alpha: 0 };
const layers = [];

for (let index = 0; index < 6; index += 1) {
  const face = await sharp(originalBytes)
    .resize(864, 1152)
    .modulate({ brightness: index === 5 ? 1 : 0.72 + index * 0.04 })
    .rotate(-2, { background: transparent })
    .png()
    .toBuffer();
  layers.push({ input: face, left: 50 + index * 20, top: 200 - index * 28 });
}

const deckPath = path.join(directory, "deck-pile.png");
const discardPath = path.join(directory, "discard-pile.png");
await sharp({ create: { width: 1086, height: 1448, channels: 4, background: transparent } })
  .composite(layers)
  .png()
  .toFile(deckPath);
await sharp(deckPath).flop().png().toFile(discardPath);

for (const file of [deckPath, discardPath]) {
  const metadata = await sharp(file).metadata();
  const stats = await sharp(file).stats();
  if (metadata.width * 4 !== metadata.height * 3 || !metadata.hasAlpha || stats.channels[3].min !== 0) {
    throw new Error("Pile must be 3:4 with genuine transparency");
  }
}
const reflectedDeck = await sharp(deckPath).flop().raw().toBuffer();
const discardPixels = await sharp(discardPath).raw().toBuffer();
if (!reflectedDeck.equals(discardPixels)) throw new Error("Discard must be an exact mirror");
if (!originalBytes.equals(await fs.readFile(masterPath))) throw new Error("Single-card master changed");

let svg =
  '<svg width="1050" height="850"><rect width="1050" height="850" fill="#101722"/><style>text{font-family:Arial;fill:#e7edf5}</style>';
const previewLayers = [];
const label = (text, x, y, size = 16) => {
  svg += `<text x="${x}" y="${y}" font-size="${size}">${text}</text>`;
};
const add = async (file, width, height, left, top) => {
  previewLayers.push({ input: await sharp(file).resize(width, height).png().toBuffer(), left, top });
};
label("ALCHEMY / OBSIDIAN SEAL CARD PILES", 30, 35, 22);
label("Deck Pile · left", 30, 78, 19);
label("Single card · animations", 375, 78, 19);
label("Discard Pile · mirrored", 715, 78, 19);
await add(deckPath, 280, 374, 30, 95);
await add(masterPath, 240, 320, 390, 120);
await add(discardPath, 280, 374, 715, 95);
label("Battle-size arrangement · 161 × 215 px piles", 30, 510, 17);
svg += '<rect x="20" y="535" width="1010" height="260" rx="12" fill="#181f2b" stroke="#394558"/>';
await add(deckPath, 161, 215, 35, 555);
await add(discardPath, 161, 215, 854, 555);
await add(masterPath, 80, 107, 485, 590);
label("Deck Pile", 68, 781, 14);
label("Single card", 490, 728, 13);
label("Discard Pile", 895, 781, 14);
label("One stack source, mirrored for Discard · Transparent PNGs · Original animation master unchanged", 30, 828, 13);
svg += "</svg>";
await sharp(Buffer.from(svg)).composite(previewLayers).png().toFile(path.join(directory, "comparison.png"));

await fs.writeFile(
  path.join(directory, "preview.html"),
  `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Obsidian Seal card piles</title><style>body{margin:0;background:#101722;color:#e7edf5;font:16px system-ui}main{padding:24px}img{display:block}a{color:#67e8f9}p{max-width:1000px}</style><main><p><a href="deck-pile.png">Deck Pile master</a> · <a href="discard-pile.png">Mirrored Discard Pile master</a> · <a href="../approved-art/card-back.png">Unchanged single card</a></p><p>Native-size samples; scroll horizontally on smaller windows. Both piles are the same composition, mirrored horizontally.</p><img src="comparison.png" width="1050" height="850" alt="Obsidian Seal deck pile, unchanged single card, and mirrored discard pile, with a battle-size lower-left and lower-right placement preview."></main></html>`,
);
console.log("Created transparent 1086 × 1448 piles; exact mirror and unchanged single-card master verified.");
