import { mkdirSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";
import { createServer } from "vite";

const server = await createServer({
  configFile: false,
  appType: "custom",
  server: { middlewareMode: true, hmr: false, ws: false },
  resolve: { alias: { "@": fileURLToPath(new URL("../src", import.meta.url)) } },
});

try {
  const { buildLootBalanceReport, renderLootBalanceReport } = await server.ssrLoadModule(
    "/src/lib/balance/loot-report.ts",
  );
  const report = buildLootBalanceReport(Number(process.env.ALCHEMY_LOOT_SAMPLES ?? 1000));
  const directory = resolve("reports/loot-progression");
  mkdirSync(directory, { recursive: true });
  writeFileSync(resolve(directory, "report.json"), JSON.stringify(report, null, 2));
  writeFileSync(resolve(directory, "report.html"), renderLootBalanceReport(report));
  console.info(`Loot report: ${resolve(directory, "report.html")}`);
} finally {
  await server.close();
}
