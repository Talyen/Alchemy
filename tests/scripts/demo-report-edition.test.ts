import { spawnSync } from "node:child_process";
import { tmpdir } from "node:os";
import { describe, expect, it } from "vitest";

describe("headless edition identity", () => {
  it("uses demo policy in SSR instead of silently running a full Campaign", () => {
    // Keep Vite's native compiler in its own process, as the shipping report workers do.
    const moduleUrl = new URL("../../scripts/lib/vite-report-server.mjs", import.meta.url).href;
    const source = `import { withReportServer } from ${JSON.stringify(moduleUrl)};
      await withReportServer(async (server) => {
        const policy = await server.ssrLoadModule('/src/lib/game-edition.ts');
        console.log(JSON.stringify({ demo: policy.IS_DEMO, acts: policy.GAME_EDITION_POLICY.campaignActs, labyrinth: policy.isEditionModeAvailable('labyrinth') }));
      });`;
    const result = spawnSync(process.execPath, ["--input-type=module", "-e", source], {
      cwd: tmpdir(),
      env: { ...process.env, ALCHEMY_EDITION: "demo" },
      encoding: "utf8",
      timeout: 20000,
    });
    expect(
      result.status,
      JSON.stringify({ signal: result.signal, error: result.error?.message, stderr: result.stderr }),
    ).toBe(0);
    expect(result.stderr).toBe("");
    expect(JSON.parse(result.stdout.split("\n").find((line) => line.startsWith('{"demo":'))!)).toEqual({
      demo: true,
      acts: 1,
      labyrinth: false,
    });
  });
});
