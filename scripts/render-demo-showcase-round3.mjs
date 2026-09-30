/* global document -- decoding executes inside the browser page */
import { chromium } from "@playwright/test";
import sharp from "sharp";
import { writeFile, mkdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { format, resolveConfig } from "prettier";
import { withReportServer } from "./lib/vite-report-server.mjs";

const root = new URL("../", import.meta.url);
const drafts = new URL("Docs/design/steam-demo-showcase/revisions/round-3/", root);
const output = new URL("reports/demo-showcase-revisions/", root);
await mkdir(fileURLToPath(drafts), { recursive: true });
await mkdir(fileURLToPath(output), { recursive: true });
const counts = await withReportServer(async (server) => {
  const data = await server.ssrLoadModule("/src/lib/game-data/index.ts");
  const gear = await server.ssrLoadModule("/src/lib/gear/index.ts");
  const home = await server.ssrLoadModule("/src/lib/homestead/data.ts");
  return {
    heroes: Object.keys(data.characters).length,
    cards: data.cardLibrary.length,
    draftCards: data.getOfferableCardPool().length,
    talents: data.talentPool.length,
    uniques: gear.uniqueItemList.length,
    trinkets: data.trinketLibrary.length,
    homestead: home.buildings.length + home.farmPlots.length + home.researchUpgrades.length,
    bosses: data.bossEnemies.map((b) => b.title),
  };
});
if (
  counts.heroes < 8 ||
  counts.draftCards < 100 ||
  counts.talents < 200 ||
  counts.uniques < 25 ||
  counts.trinkets < 20 ||
  counts.homestead < 20
)
  throw new Error("Catalog no longer supports the draft thresholds");
await writeFile(new URL("counts.json", drafts), `${JSON.stringify(counts, null, 2)}\n`);
await sharp(fileURLToPath(new URL("Raw Assets/Homestead/Wheat Field.jpeg", root)))
  .png()
  .toFile(fileURLToPath(new URL("wheat-field.png", output)));
const src = (p) =>
  p === "Homestead/Wheat Field.jpeg"
    ? "../../../../../reports/demo-showcase-revisions/wheat-field.png"
    : `../../../../../Raw%20Assets/${p.split("/").map(encodeURIComponent).join("/")}`;
const img = (p, style = "") => `<img src="${src(p)}" alt="" style="${style}">`;
const heroes = [
  ["Knight", 0.5, 0.175, 0.17],
  ["Wizard", 0.51, 0.21, 0.18],
  ["Rogue", 0.56, 0.25, 0.21],
  ["Alchemist", 0.55, 0.25, 0.155],
  ["Ranger", 0.45, 0.255, 0.175],
  ["Warlock", 0.5, 0.15, 0.2],
  ["Druid", 0.5, 0.23, 0.16],
  ["Wildcard", 0.5, 0.24, 0.2],
];
const meta = await Promise.all(
  heroes.map(([name]) => sharp(fileURLToPath(new URL(`Raw Assets/Heroes/${name}.jpeg`, root))).metadata()),
);
function faces(w, h, size) {
  const polys = [
    "0 0,53% 0,46% 24%,0 27%",
    "53% 0,100% 0,100% 23%,46% 24%",
    "0 27%,46% 24%,56% 50%,0 48%",
    "46% 24%,100% 23%,100% 52%,56% 50%",
    "0 48%,56% 50%,48% 76%,0 75%",
    "56% 50%,100% 52%,100% 74%,48% 76%",
    "0 75%,48% 76%,55% 100%,0 100%",
    "48% 76%,100% 74%,100% 100%,55% 100%",
  ];
  return heroes
    .map(([name, cx, cy, fh], i) => {
      const s = size / (fh * meta[i].height),
        iw = meta[i].width * s,
        ih = meta[i].height * s;
      const x = (i % 2 ? 0.75 : 0.25) * w,
        y = (0.12 + Math.floor(i / 2) * 0.25) * h;
      return `<div class="fragment" style="clip-path:polygon(${polys[i]})">${img(`Heroes/${name}.jpeg`, `width:${iw}px;height:${ih}px;left:${x - cx * iw}px;top:${y - cy * ih}px`)}</div>`;
    })
    .join("");
}
function panel(title, stat, x, y, w, h, art, cls = "") {
  return `<section class="panel ${cls}" style="left:${x}px;top:${y}px;width:${w}px;height:${h}px"><div class="art">${art}</div><div class="label"><span>${title}</span>${stat ? `<small>${stat}</small>` : ""}</div></section>`;
}
const boss = counts.bosses.map((n) => `<div class="boss">${img(`Enemies/${n}.jpeg`)}</div>`).join("");
const items = [
  "Trinkets/Brass Censer.jpeg",
  "Trinkets/Sin-Eater's Lantern.jpeg",
  "Gear/Flail - Astral.jpeg",
  "Crafting/Discordant Dice.png",
]
  .map((p) => `<div class="item">${img(p)}</div>`)
  .join("");
const home = ["Homestead/Wheat Field.jpeg", "Homestead/Blacksmith's Forge.jpeg", "Homestead/Library.jpeg"]
  .map((p) => img(p))
  .join("");
const draft = [
  "Misc/Draw Pile.png",
  "Cards/Slash.jpeg",
  "Cards/Fireball.jpeg",
  "Cards/Frostbolt.jpeg",
  "Cards/Poison Dagger.jpeg",
  "Misc/Discard Pile.png",
]
  .map((p, i) => img(p, `--i:${i}`))
  .join("");
const css = `@font-face{font-family:Inter;src:url('../../../../../public/fonts/Inter.woff2') format('woff2');font-weight:100 900}*{box-sizing:border-box}html,body{margin:0;width:2560px;height:1440px;background:#0c0e0c;color:#f3e4ca;overflow:hidden;font-family:Inter,sans-serif}body{padding:32px}.canvas{position:relative;width:2496px;height:1376px}.panel{position:absolute;border:2px solid #986b3280;border-radius:28px;background:#141713;overflow:hidden}.art{position:absolute;inset:0 0 104px;overflow:hidden}.label{position:absolute;inset:auto 0 0;height:104px;background:#11130f;border-top:2px solid #986b3270;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:6px;white-space:nowrap;font-size:48px;font-weight:650;letter-spacing:-1px}.label small{font-size:32px;color:#e6c58e;font-weight:500;letter-spacing:0}.fragment{position:absolute;inset:0;background:#101510}.fragment img{position:absolute;max-width:none}.bosses .art{display:flex;align-items:center;gap:6px;padding:12px}.boss{width:calc((100% - 36px)/7);height:100%;display:flex;align-items:center;justify-content:center}.boss img{width:100%;height:100%;object-fit:cover;object-position:50% 35%}.mode img{width:100%;height:100%;object-fit:cover}.loot .art{display:flex;gap:16px;align-items:center;padding:20px;background:radial-gradient(ellipse at center,#29271f,#111612)}.item{width:calc((100% - 48px)/4);height:100%;display:flex;align-items:center;justify-content:center}.item img{width:auto;height:auto;max-width:100%;max-height:100%;object-fit:contain;border:2px solid #986b32;border-radius:14px}.loot .label{font-size:32px;letter-spacing:-.4px}.home .art{display:flex;gap:4px}.home img{width:calc((100% - 8px)/3);height:100%;object-fit:cover}.draft .art{position:absolute;background:radial-gradient(ellipse at center,#30342a,#111513)}.draft img{position:absolute;object-fit:contain;height:80%;width:22%;top:10%;left:calc(1% + var(--i)*15.2%);transform:rotate(calc((var(--i) - 2.5)*5deg));filter:drop-shadow(0 8px 6px #000a)}.draft img:first-child,.draft img:last-child{height:64%;top:18%}.hero .label{font-size:46px}.hero .label small{font-size:29px}`;
const c = [
  panel("Heroes", "8+ Heroes · 200+ Talents", 0, 0, 704, 1376, faces(700, 1268, 180), "hero"),
  panel("Boss Battles", "7+ Bosses", 728, 0, 1768, 536, boss, "bosses"),
  panel("The Labyrinth", "", 728, 560, 872, 356, img("Game Modes/The Labyrinth.jpeg"), "mode"),
  panel("Wildwood Draft", "100+ Cards", 1624, 560, 872, 356, draft, "draft"),
  panel("Boons, Trinkets, Uniques, Crafting", "25+ Uniques · 20+ Trinkets", 728, 940, 872, 436, items, "loot"),
  panel("Homestead", "20+ Upgrades", 1624, 940, 872, 436, home, "home"),
].join("");
const d = [
  panel("Boss Battles", "7+ Bosses", 0, 0, 2496, 520, boss, "bosses"),
  panel("Heroes", "8+ Heroes · 200+ Talents", 0, 544, 704, 832, faces(700, 724, 130), "hero"),
  panel("The Labyrinth", "", 728, 544, 872, 354, img("Game Modes/The Labyrinth.jpeg"), "mode"),
  panel("Wildwood Draft", "100+ Cards", 1624, 544, 872, 354, draft, "draft"),
  panel("Boons, Trinkets, Uniques, Crafting", "25+ Uniques · 20+ Trinkets", 728, 922, 872, 454, items, "loot"),
  panel("Homestead", "20+ Upgrades", 1624, 922, 872, 454, home, "home"),
].join("");
const browser = await chromium.launch();
try {
  for (const [name, panels] of [
    ["expanded-mosaic", c],
    ["boss-gallery", d],
  ]) {
    const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Draft ${name}</title><style>${css}</style></head><body><main class="canvas">${panels}</main></body></html>`;
    const path = new URL(`${name}.html`, drafts);
    await writeFile(path, await format(html, { ...(await resolveConfig(fileURLToPath(path))), parser: "html" }));
    const page = await browser.newPage({ viewport: { width: 2560, height: 1440 }, deviceScaleFactor: 1 });
    await page.goto(path.href);
    await page.evaluate(async () => {
      await document.fonts.ready;
      await Promise.all(
        [...document.images].map((i) =>
          i.decode().catch(() => {
            if (!i.complete || !i.naturalWidth) throw new Error(i.src);
          }),
        ),
      );
    });
    await page.screenshot({ path: fileURLToPath(new URL(`${name}.png`, output)) });
    await page.close();
  }
} finally {
  await browser.close();
}
console.log(JSON.stringify(counts));
