/* global document -- image decoding runs in the browser page */
import { chromium } from "@playwright/test";
import sharp from "sharp";
import { writeFile, mkdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { withReportServer } from "./lib/vite-report-server.mjs";

const root = new URL("../", import.meta.url);
const drafts = new URL("Docs/design/steam-demo-showcase/revisions/", root);
const output = new URL("reports/demo-showcase-revisions/", root);
await mkdir(fileURLToPath(drafts), { recursive: true });
await mkdir(fileURLToPath(output), { recursive: true });
const counts = await withReportServer(async (server) => {
  const data = await server.ssrLoadModule("/src/lib/game-data/index.ts");
  const gear = await server.ssrLoadModule("/src/lib/gear/index.ts");
  return {
    cards: data.cardLibrary.length,
    talents: data.talentPool.length,
    uniques: gear.uniqueItemList.length,
    trinkets: data.trinketLibrary.length,
    bosses: data.bossEnemies.map((boss) => boss.title),
  };
});
await writeFile(new URL("counts.json", drafts), `${JSON.stringify(counts, null, 2)}\n`);
const src = (path) => `../../../../Raw%20Assets/${path.split("/").map(encodeURIComponent).join("/")}`;
const image = (path, style = "") => `<img src="${src(path)}" alt="" style="${style}">`;
const heroes = [
  ["Wizard", 0.51, 0.21, 0.18],
  ["Alchemist", 0.55, 0.25, 0.155],
  ["Warlock", 0.5, 0.15, 0.2],
  ["Druid", 0.5, 0.23, 0.16],
  ["Wildcard", 0.5, 0.24, 0.2],
];
const heroMeta = await Promise.all(
  heroes.map(async ([name]) => sharp(fileURLToPath(new URL(`Raw Assets/Heroes/${name}.jpeg`, root))).metadata()),
);
function heroArt(width, height, layout) {
  const polygons =
    layout === "ribbon"
      ? [
          "0 0,22% 0,18% 45%,22% 67%,18% 100%,0 100%",
          "22% 0,42% 0,38% 37%,43% 62%,38% 100%,18% 100%,22% 67%,18% 45%",
          "42% 0,62% 0,58% 48%,63% 74%,58% 100%,38% 100%,43% 62%,38% 37%",
          "62% 0,82% 0,78% 38%,83% 65%,78% 100%,58% 100%,63% 74%,58% 48%",
          "82% 0,100% 0,100% 100%,78% 100%,83% 65%,78% 38%",
        ]
      : [
          "0 0,58% 0,45% 40%,0 34%",
          "58% 0,100% 0,100% 36%,45% 40%",
          "0 34%,45% 40%,60% 70%,0 73%",
          "45% 40%,100% 36%,100% 76%,60% 70%",
          "0 73%,60% 70%,100% 76%,100% 100%,0 100%",
        ];
  return heroes
    .map(([name, cx, cy, faceHeight], index) => {
      const scale = 220 / (faceHeight * heroMeta[index].height);
      const w = heroMeta[index].width * scale;
      const h = heroMeta[index].height * scale;
      const x = layout === "ribbon" ? (0.1 + 0.2 * index) * width : [0.25, 0.76, 0.25, 0.78, 0.53][index] * width;
      const y = layout === "ribbon" ? height * 0.43 : [0.18, 0.18, 0.52, 0.52, 0.86][index] * height;
      return `<div class="fragment" style="clip-path:polygon(${polygons[index]})">${image(`Heroes/${name}.jpeg`, `width:${w}px;height:${h}px;left:${x - cx * w}px;top:${y - cy * h}px`)}</div>`;
    })
    .join("");
}
const bosses = counts.bosses.map((name) => image(`Enemies/${name}.jpeg`)).join("");
const loot = [
  "Trinkets/Brass Censer.jpeg",
  "Trinkets/Sin-Eater's Lantern.jpeg",
  "Gear/Flail - Astral.jpeg",
  "Gear/Emerald Amulet - Astral.jpeg",
  "Crafting/Discordant Dice.png",
  "Crafting/Smith's Whetstone.png",
];
const homestead = ["Homestead/Alchemy Lab.jpeg", "Homestead/Companion Sanctuary.jpeg", "Homestead/Orchard.jpeg"];
const label = (name) => `<div class="label">${name}</div>`;
function panel(name, x, y, w, h, art, classes = "") {
  return `<section class="panel ${classes}" style="left:${x}px;top:${y}px;width:${w}px;height:${h}px"><div class="art">${art}</div>${label(name)}</section>`;
}
const css = `
@font-face{font-family:Inter;src:url('../../../../public/fonts/Inter.woff2') format('woff2');font-weight:100 900}
*{box-sizing:border-box}html,body{margin:0;width:2560px;height:1440px;overflow:hidden;background:#0c0e0c;color:#f3e4ca;font-family:Inter,sans-serif}
body{padding:32px}.canvas{position:relative;width:2496px;height:1192px}.panel{position:absolute;border:2px solid #986b3280;border-radius:28px;overflow:hidden;background:#141713}.art{position:absolute;inset:0 0 76px;overflow:hidden}.label{position:absolute;inset:auto 0 0;height:76px;display:flex;align-items:center;justify-content:center;background:#11130f;border-top:2px solid #986b3270;font-size:52px;font-weight:650;letter-spacing:-1px;white-space:nowrap}
.fragment{position:absolute;inset:0;background:#101510}.fragment img{position:absolute;max-width:none;object-fit:fill}
.bosses .art{display:flex;gap:3px}.bosses img{width:calc((100% - 18px)/7);height:100%;object-fit:cover;object-position:50% 12%}
.mode img{width:100%;height:100%;object-fit:cover}.loot .art{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));grid-template-rows:repeat(2,minmax(0,1fr));gap:12px;padding:22px;background:radial-gradient(ellipse at center,#29271f,#111612)}.loot img{width:100%;height:100%;min-height:0;object-fit:cover;border:2px solid #986b32;border-radius:16px}.loot .label{font-size:36px;letter-spacing:-.5px}
.home .art{display:flex;gap:3px}.home img{width:calc((100% - 6px)/3);height:100%;object-fit:cover}
.stats{margin-top:24px;width:2496px;height:160px;display:flex;align-items:center;justify-content:space-around;border-top:2px solid #986b3290}.stat{display:flex;align-items:baseline;gap:20px}.stat b{font-size:78px;font-weight:650;color:#e6c58e}.stat span{font-size:42px;font-weight:500}
`;
const stats = `<div class="stats"><div class="stat"><b>100+</b><span>Cards</span></div><div class="stat"><b>200+</b><span>Talents</span></div><div class="stat"><b>25+</b><span>Uniques</span></div><div class="stat"><b>20+</b><span>Trinkets</span></div></div>`;
const a = [
  panel("More Heroes", 0, 0, 2496, 380, heroArt(2492, 300, "ribbon")),
  panel("The Labyrinth", 0, 404, 700, 382, image("Game Modes/The Labyrinth.jpeg"), "mode"),
  panel("Wildwood Draft", 0, 810, 700, 382, image("Game Modes/Wildwood Draft.jpeg"), "mode"),
  panel("Boss Battles", 724, 404, 1024, 788, bosses, "bosses"),
  panel("Boons, Trinkets, Uniques, Crafting", 1772, 404, 724, 382, loot.map((p) => image(p)).join(""), "loot"),
  panel("Homestead", 1772, 810, 724, 382, homestead.map((p) => image(p)).join(""), "home"),
].join("");
const b = [
  panel("More Heroes", 0, 0, 770, 1192, heroArt(766, 1112, "mosaic")),
  panel("Boss Battles", 794, 0, 1702, 340, bosses, "bosses"),
  panel("The Labyrinth", 794, 364, 839, 370, image("Game Modes/The Labyrinth.jpeg"), "mode"),
  panel("Wildwood Draft", 1657, 364, 839, 370, image("Game Modes/Wildwood Draft.jpeg"), "mode"),
  panel("Boons, Trinkets, Uniques, Crafting", 794, 758, 839, 434, loot.map((p) => image(p)).join(""), "loot"),
  panel("Homestead", 1657, 758, 839, 434, homestead.map((p) => image(p)).join(""), "home"),
].join("");
const browser = await chromium.launch();
try {
  for (const [name, panels] of [
    ["ribbon", a],
    ["mosaic", b],
  ]) {
    const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Unapproved showcase ${name}</title><style>${css}</style></head><body><main class="canvas">${panels}</main>${stats}</body></html>`;
    const path = new URL(`${name}.html`, drafts);
    await writeFile(path, html);
    const page = await browser.newPage({ viewport: { width: 2560, height: 1440 }, deviceScaleFactor: 1 });
    await page.goto(path.href);
    await page.evaluate(async () => {
      await document.fonts.ready;
      await Promise.all([...document.images].map((image) => image.decode()));
    });
    await page.screenshot({ path: fileURLToPath(new URL(`${name}.png`, output)) });
    await page.close();
  }
} finally {
  await browser.close();
}
console.log(JSON.stringify(counts));
