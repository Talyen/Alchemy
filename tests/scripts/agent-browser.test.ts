import { createCleanup } from "@/lib/cleanup";
import { execFileSync } from "node:child_process";
import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";

// Exercise the actual wrapper while keeping browser execution and ownership fake.
function harness() {
  const root = mkdtempSync(path.join(tmpdir(), "alchemy-browser-cli-"));
  mkdirSync(path.join(root, "lib"));
  const script = path.join(root, "agent-browser.mjs");
  copyFileSync(path.join(process.cwd(), "scripts/agent-browser.mjs"), script);
  writeFileSync(
    path.join(root, "lib/agent-browser-session.mjs"),
    `
    import { existsSync, writeFileSync } from "node:fs";
    export const ROOT = ${JSON.stringify(root)};
    export const taskKey = () => "test-task";
    export const browserSocketDirectory = () => ROOT;
    export const recoverBrowsers = async () => {};
    export const closeTaskBrowsers = async () => writeFileSync(ROOT + "/closed", "yes");
    export const watchBrowser = async () => {};
    export const captureBrowser = async () => {
      if (!existsSync(ROOT + "/viewport.json")) return undefined;
      const created = !existsSync(ROOT + "/registered");
      writeFileSync(ROOT + "/registered", "yes");
      return created;
    };
  `,
  );
  writeFileSync(
    path.join(root, "agent-browser"),
    `#!${process.execPath}
    const fs = require("node:fs");
    const args = process.argv.slice(2);
    const file = ${JSON.stringify(path.join(root, "viewport.json"))};
    let viewport = fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, "utf8")) : [1280, 720];
    const set = args.indexOf("set");
    if (set >= 0 && args[set + 1] === "viewport") viewport = args.slice(set + 2, set + 4).map(Number);
    if (set >= 0 && args[set + 1] === "device") viewport = [390, 844];
    fs.writeFileSync(file, JSON.stringify(viewport));
    fs.appendFileSync(${JSON.stringify(path.join(root, "calls.jsonl"))}, JSON.stringify(args) + "\\n");
    console.log(args.includes("--json") ? JSON.stringify({ viewport }) : "Viewport: " + viewport.join("x"));
  `,
    { mode: 0o755 },
  );
  return {
    run: (...args: string[]) =>
      execFileSync(process.execPath, [script, ...args], {
        cwd: root,
        encoding: "utf8",
        env: { ...process.env, PATH: `${root}:${process.env.PATH}` },
      }),
    viewport: () => JSON.parse(readFileSync(path.join(root, "viewport.json"), "utf8")),
    calls: () =>
      readFileSync(path.join(root, "calls.jsonl"), "utf8")
        .trim()
        .split("\n")
        .map((line) => JSON.parse(line) as string[]),
    cleanup: () => rmSync(root, { recursive: true, force: true }),
  };
}

describe.skipIf(process.platform === "win32")("managed browser command output", () => {
  it.each(["viewport", "device"])("preserves an explicit first %s behind global flags", (setting) => {
    const cli = harness();
    using _scopeCleanup = createCleanup(() => cli.cleanup());

    const output = cli.run(
      "--config",
      "/tmp/browser-config.json",
      "--headed",
      "false",
      "--json",
      "set",
      setting,
      ...(setting === "viewport" ? ["800", "600"] : ["iPhone 13"]),
    );
    const expected = setting === "viewport" ? [800, 600] : [390, 844];
    expect(JSON.parse(output)).toEqual({ viewport: expected });
    expect(cli.viewport()).toEqual(expected);
  });

  it.each(["screenshot", "snapshot"])(
    "publishes the first %s at the default size and keeps later resizes",
    (capture) => {
      const cli = harness();
      using _scopeCleanup = createCleanup(() => cli.cleanup());

      expect(JSON.parse(cli.run("--json", capture))).toEqual({ viewport: [1920, 1080] });
      cli.run("set", "viewport", "800", "600");
      expect(JSON.parse(cli.run("--json", capture))).toEqual({ viewport: [800, 600] });
    },
  );

  it("keeps initialization out of JSON output and never repeats a mutating command", () => {
    const cli = harness();
    using _scopeCleanup = createCleanup(() => cli.cleanup());

    expect(JSON.parse(cli.run("--json", "eval", "window.counter++"))).toEqual({ viewport: [1280, 720] });
    expect(cli.calls().filter((args) => args.includes("eval"))).toHaveLength(1);
    expect(cli.viewport()).toEqual([1920, 1080]);
  });
});
