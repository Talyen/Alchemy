import path from "node:path";
import { expect, it } from "vitest";
import { demoPlaytestLaunch } from "../../scripts/play-demo.mjs";
it("offline demo playtest launch always selects demo, packaged assets and a separate persistent scratch profile", () => {
  const root = path.resolve("fixture-repo");
  const launch = demoPlaytestLaunch(root, { ALCHEMY_EDITION: "full", ELECTRON_FORCE_PACKAGED_RENDERER: "0" });
  expect(launch.args).toEqual([root, `--user-data-dir=${path.join(root, "scratch/demo-playtest-profile")}`]);
  expect(launch.env.ALCHEMY_EDITION).toBe("demo");
  expect(launch.env.ELECTRON_FORCE_PACKAGED_RENDERER).toBe("1");
});
