import net from "node:net";
import fs from "node:fs";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { setTimeout as delay } from "node:timers/promises";
import { expect, it } from "vitest";
import { acquireLocalTestLane, usesLocalTestLane } from "../../scripts/lib/verification/local-test-lane.mjs";

async function reclaimReleasedPort(port: number) {
  // A sibling fixture can receive this ephemeral port after release. Only
  // reclamation retries; occupied-lane rejection below stays immediate.
  const deadline = Date.now() + 1_000;
  for (;;) {
    try {
      return await acquireLocalTestLane(port);
    } catch (error) {
      if (
        !(error instanceof Error) ||
        !error.message.startsWith("Local test lane is occupied") ||
        Date.now() >= deadline
      )
        throw error;
      await delay(10);
    }
  }
}

it("rejects an overlapping run without disturbing its owner, then permits reuse after release", async () => {
  const first = await acquireLocalTestLane(0);
  try {
    await expect(acquireLocalTestLane(first.port)).rejects.toThrow("no tests were started");
    await expect(acquireLocalTestLane(first.port)).rejects.toThrow("no tests were started");
  } finally {
    await first.release();
  }
  const next = await reclaimReleasedPort(first.port);
  await next.release();
});

it("preserves an unrelated listener instead of treating the occupied port as a stale owner", async () => {
  const server = net.createServer();
  await new Promise<void>((resolve) => {
    server.listen(0, "127.0.0.1", resolve);
  });
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("Expected TCP address");
  try {
    await expect(acquireLocalTestLane(address.port)).rejects.toThrow("inspect the port owner");
    expect(server.listening).toBe(true);
  } finally {
    await new Promise<void>((resolve) => {
      server.close(() => resolve());
    });
  }
});

it("releases the lane after its owning process terminates without a cleanup hook", async () => {
  const moduleUrl = new URL("../../scripts/lib/verification/local-test-lane.mjs", import.meta.url).href;
  const child = spawn(
    process.execPath,
    [
      "--input-type=module",
      "-e",
      `import { acquireLocalTestLane } from ${JSON.stringify(moduleUrl)};
const lane = await acquireLocalTestLane(0); console.log(lane.port);`,
    ],
    { stdio: ["ignore", "pipe", "pipe"] },
  );
  const exited = once(child, "exit");
  try {
    const [output] = await once(child.stdout, "data");
    const port = Number(String(output).trim());
    await expect(acquireLocalTestLane(port)).rejects.toThrow("no tests were started");
    child.kill("SIGTERM");
    await exited;
    const replacement = await reclaimReleasedPort(port);
    await replacement.release();
  } finally {
    if (child.exitCode === null && child.signalCode === null) child.kill("SIGTERM");
    await exited;
  }
});

it("shares the lane between unit and browser commands while leaving small non-test commands alone", () => {
  expect(usesLocalTestLane("vitest", ["run"])).toBe(true);
  expect(usesLocalTestLane("/bin/npx", ["vitest", "related"])).toBe(true);
  expect(usesLocalTestLane("C:\\bin\\playwright.cmd", ["test"])).toBe(true);
  expect(usesLocalTestLane("npx", ["playwright", "test"])).toBe(true);
  expect(usesLocalTestLane("node", ["scripts/check.mjs"])).toBe(false);
  for (const flag of ["--watch", "-w", "--ui", "--debug", "--watch=true", "--ui=localhost"]) {
    expect(usesLocalTestLane("vitest", [flag]), flag).toBe(false);
  }
  expect(usesLocalTestLane("vitest", ["--watch=false"])).toBe(true);
  const { scripts } = JSON.parse(fs.readFileSync(new URL("../../package.json", import.meta.url), "utf8"));
  expect(scripts["test:e2e:timings"]).toContain("node scripts/run-compact.mjs playwright test");
});
