import { readFileSync, writeFileSync, appendFileSync } from "node:fs";
import { defineScript } from "./lib/script-run.mjs";
import { withReportServer } from "./lib/vite-report-server.mjs";

defineScript(import.meta.url, async () => {
  const [input, output, journal] = process.argv.slice(2);
  const request = JSON.parse(readFileSync(input, "utf8"));
  // Process-local platform inputs; never installed in the shipping application.
  let id = 0;
  Object.defineProperty(globalThis, "crypto", {
    configurable: true,
    value: { randomUUID: () => `00000000-0000-4000-8000-${(++id).toString(16).padStart(12, "0")}` },
  });
  Date.now = () => 1_800_000_000_000;
  await withReportServer(async (server) => {
    const { runCareer } = await server.ssrLoadModule("/src/app/playthrough/career.ts");
    if (request.fixture) {
      const { createPlaythroughFixture } = await server.ssrLoadModule("/src/app/playthrough/fixtures.ts");
      request.config.initialSave = createPlaythroughFixture(request.fixture);
    }
    if (request.runtimeInputs) id = request.runtimeInputs.idCounter;
    else if (request.config.initialSave) {
      // Imported harness saves may already own deterministic IDs. Continue
      // their sequence so newly dropped gear cannot collide with saved items.
      for (const match of JSON.stringify(request.config.initialSave).matchAll(
        /00000000-0000-4000-8000-([0-9a-f]{12})/g,
      ))
        id = Math.max(id, Number.parseInt(match[1], 16));
    }
    const { createDefaultSaveData } = await server.ssrLoadModule("/src/features/alchemy/shared/storage/defaults.ts");
    const runtimeInputs = { idCounter: id, clock: 1_800_000_000_000, policyVersion: 1 };
    writeFileSync(
      `${output}.start`,
      JSON.stringify({
        version: 1,
        config: request.config,
        initialSave: request.config.initialSave ?? createDefaultSaveData(),
        runtimeInputs,
        codeIdentity: request.codeIdentity,
      }),
    );
    let journalBytes = 0;
    const result = await runCareer(
      request.config,
      (entry) => {
        const line = `${JSON.stringify(entry)}\n`;
        journalBytes += Buffer.byteLength(line);
        if (journalBytes > 32 * 1024 * 1024) throw new Error("Incomplete: replay evidence budget exhausted");
        appendFileSync(journal, line);
      },
      request.replay,
      request.checkpointAt
        ? {
            at: request.checkpointAt,
            save: (bytes) =>
              writeFileSync(
                `${output}.checkpoint`,
                JSON.stringify({ bytes, runtimeInputs: { ...runtimeInputs, idCounter: id } }),
              ),
          }
        : undefined,
    );
    result.runtimeInputs = runtimeInputs;
    writeFileSync(output, JSON.stringify(result, null, 2));
  });
});
