import { readFileSync, writeFileSync, appendFileSync } from "node:fs";
import { defineScript } from "./lib/script-run.mjs";
import { withReportServer } from "./lib/vite-report-server.mjs";

defineScript(import.meta.url, async () => {
  const [input, output, journal] = process.argv.slice(2);
  const request = JSON.parse(readFileSync(input, "utf8"));
  await withReportServer(async (server) => {
    const { runCareer } = await server.ssrLoadModule("/src/app/playthrough/career.ts");
    const { createCareerRuntime } = await server.ssrLoadModule("/src/app/playthrough/career-runtime.ts");
    const runtime = createCareerRuntime(request.config.seed, request.config.initialSave, request.runtimeInputs);
    if (request.fixture) {
      const { createPlaythroughFixture } = await server.ssrLoadModule("/src/app/playthrough/fixtures.ts");
      request.config.initialSave = createPlaythroughFixture(request.fixture, runtime.session);
    }
    const { createDefaultSaveData } = await server.ssrLoadModule("/src/features/alchemy/shared/storage/defaults.ts");
    const runtimeInputs = runtime.snapshot();
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
                JSON.stringify({ bytes, runtimeInputs: runtime.snapshot() }),
              ),
          }
        : undefined,
      runtime,
    );
    result.runtimeInputs = runtimeInputs;
    writeFileSync(output, JSON.stringify(result, null, 2));
  });
});
