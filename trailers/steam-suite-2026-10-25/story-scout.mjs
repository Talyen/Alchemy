import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { log } from "node:console";
import { createServer } from "vite";
import { chromium } from "@playwright/test";
import { prepareAction, performAction } from "../../scripts/trailers/direction.mjs";

// Private scouting, never trailer footage: save only states reached through UI inputs.
const root = path.resolve(import.meta.dirname, "../..");
const out = path.resolve(process.argv[2]);
if (fs.existsSync(out) && fs.readdirSync(out).length) throw new Error("Choose a fresh scout directory");
fs.mkdirSync(out, { recursive: true });
const dependencies = Object.keys(JSON.parse(fs.readFileSync(path.join(root, "package.json"))).dependencies).filter(
  (name) => !["@sentry/electron", "steamworks.js"].includes(name),
);
const server = await createServer({
  root,
  define: { "import.meta.env.DEV": "false" },
  cacheDir: path.join(root, "scratch/trailer-vite-cache"),
  server: { host: "127.0.0.1", port: 0, open: false, hmr: false, watch: null },
  optimizeDeps: {
    noDiscovery: true,
    include: [...dependencies, "react-dom/client", "react/jsx-runtime", "react/jsx-dev-runtime", "motion/react"],
  },
  logLevel: "warn",
});
let browser;
const events = [];
const write = (file, value) => fs.writeFileSync(path.join(out, file), JSON.stringify(value, null, 2) + "\n");
try {
  await server.listen();
  await Promise.all([server.warmupRequest("/src/startup.ts"), server.warmupRequest("/src/main.tsx")]);
  await server.environments.client.waitForRequestsIdle();
  const scenarios = await server.ssrLoadModule("/tests/trailers/scenarios.ts");
  browser = await chromium.launch({ channel: "chromium", headless: true });
  const context = await browser.newContext({
    baseURL: `http://127.0.0.1:${server.httpServer.address().port}`,
    viewport: { width: 1920, height: 1080 },
  });
  const page = await context.newPage();
  page.setDefaultTimeout(15000);
  await scenarios.openTrailerScene(page, { scene: "shop", hero: "knight", seed: 42, lyrics: false });
  const save = () => page.evaluate(() => JSON.parse(globalThis.localStorage.getItem("alchemy-save-v1")));
  const buttons = () =>
    page
      .getByRole("button")
      .evaluateAll((nodes) => nodes.map((node) => node.getAttribute("aria-label") || node.textContent));
  write("shop-before.json", await save());
  write("shop-buttons.json", await buttons());
  const buy = page.getByRole("button", { name: /^Buy Serrated Arrowhead/u }).first();
  if (!(await buy.isVisible())) throw new Error("Expected current shop offer; inspect scout evidence");
  await buy.click();
  await page.waitForTimeout(700);
  write("shop-after.json", await save());
  await page.getByRole("button", { name: "Leave", exact: true }).click();
  await page.waitForTimeout(700);
  write("route-after-purchase.json", await save());
  const combat = page.getByRole("button", { name: /^(Combat|Elite Combat)$/ }).first();
  if (!(await combat.isVisible())) {
    write("route-buttons.json", await buttons());
    throw new Error("No combat route in this scout");
  }
  await combat.click();
  await page.getByTestId("battle-scene").waitFor();
  await page.waitForTimeout(1800);
  const priority = [
    "Anvil",
    "Plate Mail",
    "Spiked Shield",
    "Block",
    "Shield Bash",
    "Bash",
    "Sunder",
    "Serrated Arrowhead",
  ];
  for (let turn = 0; turn < 10; turn++) {
    write(`turn-${turn}-start.json`, await save());
    for (let step = 0; step < 10; step++) {
      if ((await save()).activeRun?.activity?.kind !== "battle") break;
      if (!(await page.getByTestId("battle-scene").isVisible())) break;
      let prepared;
      try {
        prepared = await prepareAction(page, { kind: "hover", target: { cardPriority: priority, index: 0 } });
      } catch (error) {
        if (String(error).includes("No playable card")) break;
        throw error;
      }
      await page.mouse.move(prepared.point.x, prepared.point.y);
      await page.waitForTimeout(250);
      const action = await prepareAction(page, { kind: "play-card" });
      const before = await save();
      write(`turn-${turn}-play-${step}-before.json`, before);
      await page.mouse.move(action.point.x, action.point.y);
      await performAction(page, action);
      await page.waitForTimeout(1300);
      const after = await save();
      write(`turn-${turn}-play-${step}-after.json`, after);
      const b = before.activeRun?.activity?.data?.battleState;
      const a = after.activeRun?.activity?.data?.battleState;
      const record = {
        turn,
        step,
        label: action.label,
        before: b
          ? { hp: b.playerHealth, enemy: b.enemyHealth, forge: b.playerStatuses.forge, block: b.playerStatuses.block }
          : null,
        after: a
          ? { hp: a.playerHealth, enemy: a.enemyHealth, forge: a.playerStatuses.forge, block: a.playerStatuses.block }
          : after.activeRun?.activity?.kind,
      };
      events.push(record);
      write("events.json", events);
      log(JSON.stringify(record));
    }
    if ((await save()).activeRun?.activity?.kind !== "battle" || !(await page.getByTestId("battle-scene").isVisible()))
      break;
    const end = page.getByRole("button", { name: "End Turn", exact: true });
    if (!(await end.isEnabled())) break;
    await end.click();
    await page.waitForTimeout(2400);
  }
  write("final-save.json", await save());
  write("final-buttons.json", await buttons());
} finally {
  write("events.json", events);
  if (browser) await browser.close();
  await server.close();
}
