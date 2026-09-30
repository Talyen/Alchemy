import { Buffer } from "node:buffer";
import console from "node:console";
import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";

sharp.concurrency(1);
sharp.cache({ memory: 24, files: 0, items: 32 });

const root = path.resolve("reports/layout-review");
const escape = (text) => String(text).replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll('"', "&quot;");
const records = [];
for (const pass of ["before", "after", "stress", "demo"]) {
  const folder = path.join(root, pass);
  if (!fs.existsSync(folder)) continue;
  for (const file of fs
    .readdirSync(folder)
    .filter((file) => file.endsWith(".json") && !file.startsWith("foreground-"))) {
    const record = JSON.parse(fs.readFileSync(path.join(folder, file), "utf8"));
    records.push({ ...record, pass, image: `${pass}/${file.replace(/\.json$/, ".png")}` });
  }
}
const groups = new Map();
const latest = new Map();
for (const record of records) {
  const key = `${record.pass}/${record.name}`;
  if (!groups.has(key)) groups.set(key, []);
  groups.get(key).push(record);
  if (record.pass !== "demo" || record.name.startsWith("demo-")) {
    latest.set(`${record.name}/${record.width}x${record.height}/${record.dpr}`, record);
  }
}
for (const record of latest.values()) {
  const key = `latest/${record.name}`;
  if (!groups.has(key)) groups.set(key, []);
  groups.get(key).push(record);
}
const inventory = JSON.parse(fs.readFileSync("tests/layout-review/inventory.json", "utf8"));
const missing = inventory.requiredStates.flatMap((state) =>
  inventory.baselineViewports
    .filter(
      ([width, height]) =>
        !records.some((record) => record.name === state && record.width === width && record.height === height),
    )
    .map(([width, height]) => ({ state, width, height })),
);
fs.mkdirSync(path.join(root, "sheets"), { recursive: true });
for (const [group, captures] of groups) {
  const sheetPath = path.join(root, "sheets", `${group.replaceAll("/", "--")}.png`);
  const fingerprintPath = `${sheetPath}.json`;
  const fingerprint = JSON.stringify(
    captures.map((record) => [record.image, fs.statSync(path.join(root, record.image)).mtimeMs]),
  );
  if (
    fs.existsSync(sheetPath) &&
    fs.existsSync(fingerprintPath) &&
    fs.readFileSync(fingerprintPath, "utf8") === fingerprint
  )
    continue;
  const tiles = [];
  for (const [index, record] of captures.entries()) {
    const thumbnail = await sharp(path.join(root, record.image))
      .resize(480, 270, { fit: "contain", background: "#151515" })
      .toBuffer();
    const label = Buffer.from(
      `<svg width="480" height="30"><rect width="480" height="30" fill="#222"/><text x="10" y="21" fill="white" font-family="sans-serif" font-size="17">${record.width}×${record.height} · DPR ${record.dpr}</text></svg>`,
    );
    tiles.push({ input: thumbnail, left: (index % 3) * 480, top: Math.floor(index / 3) * 300 + 30 });
    tiles.push({ input: label, left: (index % 3) * 480, top: Math.floor(index / 3) * 300 });
  }
  await sharp({
    create: { width: 1440, height: Math.ceil(captures.length / 3) * 300, channels: 3, background: "#151515" },
  })
    .composite(tiles)
    .png()
    .toFile(sheetPath);
  fs.writeFileSync(fingerprintPath, fingerprint);
}
fs.writeFileSync(
  path.join(root, "coverage.json"),
  JSON.stringify(
    { generatedAt: new Date().toISOString(), captures: records.length, states: [...groups.keys()], missing, records },
    null,
    2,
  ),
);
const sections = [...groups]
  .filter(
    ([group]) =>
      group.startsWith("latest/") || /^(before|after)\/(game-menu|armory(?:-.*)?|defeat-dense-recap)$/.test(group),
  )
  .sort(([a], [b]) => Number(b.startsWith("latest/")) - Number(a.startsWith("latest/")) || a.localeCompare(b))
  .map(
    ([group, captures]) =>
      `<section><h2>${escape(group)}</h2><a href="sheets/${group.replaceAll("/", "--")}.png"><img class="sheet" loading="lazy" src="sheets/${group.replaceAll("/", "--")}.png"></a><div>${captures.map((record) => `<a href="${record.image}">${record.width}×${record.height}</a>`).join(" · ")}</div></section>`,
  )
  .join("");
fs.writeFileSync(
  path.join(root, "index.html"),
  `<!doctype html><meta charset="utf-8"><title>Alchemy layout review</title><style>body{background:#151515;color:#eee;font:16px system-ui;margin:32px}a{color:#9cf}.sheet{width:min(100%,1440px)}section{margin:40px 0}</style><h1>Alchemy desktop layout review</h1><p>${records.length} captures, ${groups.size} state/pass combinations. Click a viewport link for the full-size screenshot. See coverage.json for renderer dimensions, DPR, and clipping diagnostics.</p>${sections}`,
);
console.log(`Gallery: ${path.join(root, "index.html")} (${records.length} captures)`);
