/* global document -- layout editing and decode checks execute in the browser */
import { chromium } from "@playwright/test";
import sharp from "sharp";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { format, resolveConfig } from "prettier";

const root = new URL("../", import.meta.url);
const source = new URL("Docs/design/steam-demo-showcase/revisions/round-3/boss-gallery.html", root);
const folder = new URL("Docs/design/steam-demo-showcase/revisions/round-4/", root);
const output = new URL("reports/demo-showcase-revisions/", root);
await mkdir(fileURLToPath(folder), { recursive: true });
await mkdir(fileURLToPath(output), { recursive: true });
await sharp(fileURLToPath(new URL("Raw Assets/Homestead/Wheat Field.jpeg", root)))
  .png()
  .toFile(fileURLToPath(new URL("wheat-field.png", output)));
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
const metadata = await Promise.all(
  heroes.map(([name]) => sharp(fileURLToPath(new URL(`Raw Assets/Heroes/${name}.jpeg`, root))).metadata()),
);
const polygons = [
  "0 0,35% 0,31% 32%,0 35%",
  "35% 0,67% 0,70% 35%,31% 32%",
  "67% 0,100% 0,100% 36%,70% 35%",
  "0 35%,31% 32%,55% 60%,38% 64%,0 68%",
  "31% 32%,70% 35%,100% 36%,100% 68%,70% 64%,38% 64%,55% 60%",
  "0 68%,38% 64%,35% 100%,0 100%",
  "38% 64%,70% 64%,68% 100%,35% 100%",
  "70% 64%,100% 68%,100% 100%,68% 100%",
];
function cast(width, height) {
  const centers = [
    [0.16, 0.15],
    [0.5, 0.15],
    [0.84, 0.15],
    [0.27, 0.49],
    [0.73, 0.49],
    [0.16, 0.83],
    [0.5, 0.83],
    [0.84, 0.83],
  ];
  return heroes
    .map(([name, cx, cy, fh], i) => {
      const scale = 150 / (fh * metadata[i].height),
        w = metadata[i].width * scale,
        h = metadata[i].height * scale;
      const [x, y] = centers[i];
      return `<div class="fragment" style="clip-path:polygon(${polygons[i]})"><img src="../../../../../Raw%20Assets/Heroes/${name}.jpeg" alt="" style="width:${w}px;height:${h}px;left:${x * width - cx * w}px;top:${y * height - cy * h}px"></div>`;
    })
    .join("");
}
const base = await readFile(source, "utf8");
const shared = `.label small{display:none}.panel{background:transparent}.item img{border:0;border-radius:8px}.loot .art{background:radial-gradient(ellipse at center,#1c211a,#0c0e0c)}.hero .label{font-size:46px}.label{font-size:46px}`;
const variants = [
  [
    "quiet-gallery",
    `${shared}.panel{border:0;border-radius:18px}.label{height:62px;border:0;background:transparent}.art{inset:0 0 68px}.bosses .art{padding:0;gap:5px}.hero .art{border-radius:18px;overflow:hidden}.mode .art,.home .art{border-radius:18px;overflow:hidden}.loot .label{font-size:32px}`,
  ],
  [
    "editorial-collage",
    `${shared}.panel{border:0;border-radius:0}.art{inset:0}.label{height:72px;border:0;background:linear-gradient(transparent,#0c0e0ce8 65%);justify-content:flex-end;padding-bottom:7px;text-shadow:0 2px 5px #000}.bosses .art{padding:0;gap:2px}.hero .art{mask-image:linear-gradient(to bottom,#000 91%,transparent)}.mode .art,.home .art{mask-image:linear-gradient(to bottom,#000 80%,transparent)}.loot .label{font-size:32px}`,
  ],
];
const browser = await chromium.launch();
try {
  for (const [name, css] of variants) {
    const page = await browser.newPage({ viewport: { width: 2560, height: 1440 }, deviceScaleFactor: 1 });
    const path = new URL(`${name}.html`, folder);
    await writeFile(path, base.replace("</head>", `<style>${css}</style></head>`));
    await page.goto(path.href);
    const dimensions = await page
      .locator(".hero .art")
      .evaluate((el) => ({ width: el.clientWidth, height: el.clientHeight }));
    await page.locator(".hero .art").evaluate(
      (el, html) => {
        el.innerHTML = html;
      },
      cast(dimensions.width, dimensions.height),
    );
    await page.evaluate(async () => {
      await document.fonts.ready;
      await Promise.all(
        [...document.images].map((i) =>
          i.decode().catch(() => {
            if (!i.complete || !i.naturalWidth) throw Error(i.src);
          }),
        ),
      );
    });
    await page.screenshot({ path: fileURLToPath(new URL(`${name}.png`, output)) });
    await writeFile(
      path,
      await format(await page.content(), { ...(await resolveConfig(fileURLToPath(path))), parser: "html" }),
    );
    await page.close();
  }
} finally {
  await browser.close();
}
