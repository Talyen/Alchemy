import { EventEmitter } from "node:events";
import type { Page, Request } from "@playwright/test";
import { afterEach, describe, expect, it, vi } from "vitest";
import { collectStartupDiagnostics } from "../e2e/startup-diagnostics";
import {
  buildFailureDiagnostic,
  MAX_DIAGNOSTIC_BYTES,
} from "../../scripts/lib/verification/playwright-diagnostics.mjs";

function request(name: string, type = "script") {
  return {
    resourceType: () => type,
    url: () => `http://localhost:4273/${name}`,
    failure: () => ({ errorText: "net::ERR_ABORTED" }),
  } as Request;
}
function fixture() {
  const events = new EventEmitter();
  const evaluate = vi
    .fn()
    .mockResolvedValue({ elapsedMs: 20, responseEndMs: 10, domContentLoadedMs: 0, loadMs: 0, readyState: "loading" });
  const page = Object.assign(events, { evaluate }) as unknown as Page;
  const logs: string[] = [];
  const diagnostics = collectStartupDiagnostics(page, { mode: "dev", workers: 2 }, (message) => logs.push(message));
  return { events, evaluate, logs, diagnostics };
}
afterEach(() => vi.useRealTimers());

describe("browser startup evidence", () => {
  it("records pending, failed and HTTP-error modules, timing and mode, then removes its listeners", async () => {
    const { events, logs, diagnostics } = fixture();
    const completed = request("completed.ts");
    const failed = request("failed.ts?private=value");
    const missing = request("missing.ts");
    for (const item of [completed, failed, missing, request("pending.ts"), request("image.png", "image")])
      events.emit("request", item);
    events.emit("requestfinished", completed);
    events.emit("requestfailed", failed);
    events.emit("response", { request: () => missing, status: () => 404 });
    events.emit("requestfinished", missing);
    diagnostics.stop();
    await diagnostics.snapshot();
    expect(logs.join("\n")).toContain("[Request failed] http://localhost:4273/failed.ts: net::ERR_ABORTED");
    expect(logs.join("\n")).toContain("[HTTP 404] http://localhost:4273/missing.ts");
    expect(logs.join("\n")).toContain("mode=dev workers=2; 1 tracked pending");
    expect(logs.join("\n")).toContain("pending.ts");
    expect(logs.join("\n")).toContain('"domContentLoadedMs":0');
    expect(logs.join("\n")).not.toMatch(/private|image\.png|completed\.ts/);
    expect(events.eventNames()).toEqual([]);
  });

  it("bounds request tracking and shares the existing diagnostic byte budget during floods", async () => {
    const { events, logs, diagnostics } = fixture();
    for (let index = 0; index < 70; index += 1) events.emit("request", request(`module-${index}.ts`));
    diagnostics.stop();
    await diagnostics.snapshot();
    expect(logs[0]).toContain("40 tracked pending document/module requests; 30 requests omitted at capacity");
    expect(logs.filter((log) => /^\[Pending \d/.test(log))).toHaveLength(5);
    const diagnostic = buildFailureDiagnostic({
      runId: "startup-flood",
      title: "Loading",
      file: "tests/example.spec.ts",
      status: "failed",
      duration: 20000,
      logs: [...Array.from({ length: 200 }, () => "warning ".repeat(300)), ...logs],
      accessibilitySnapshot: '- text "Loading"',
    });
    expect(Buffer.byteLength(diagnostic.markdown)).toBeLessThanOrEqual(MAX_DIAGNOSTIC_BYTES);
    expect(diagnostic.markdown).toContain("mode=dev workers=2");
    expect(diagnostic.markdown).toContain("Navigation timing");
    expect(diagnostic.omittedLogs).toBeGreaterThan(0);
  });

  it("still returns evidence when the page is closed or unresponsive", async () => {
    const { evaluate, diagnostics, logs } = fixture();
    diagnostics.stop();
    evaluate.mockRejectedValueOnce(new Error("page closed"));
    await diagnostics.snapshot();
    expect(logs.at(-1)).toContain("unavailable: page closed");
    vi.useFakeTimers();
    evaluate.mockReturnValueOnce(new Promise(() => {}));
    const snapshot = diagnostics.snapshot();
    await vi.advanceTimersByTimeAsync(2_000);
    await snapshot;
    expect(logs.at(-1)).toContain("page did not answer within 2 seconds");
    expect(vi.getTimerCount()).toBe(0);
  });
});
