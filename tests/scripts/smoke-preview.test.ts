import { EventEmitter } from "node:events";
import type { ChildProcess } from "node:child_process";
import { describe, expect, it } from "vitest";
import {
  extractBuildResourceUrls,
  smokePreview,
  stopChildProcess,
  waitForProcessReady,
  watchChildProcess,
} from "../../scripts/smoke-preview.mjs";

class FakeChildProcess extends EventEmitter {
  readonly signals: Array<NodeJS.Signals | number | undefined> = [];
  onKill?: (signal: NodeJS.Signals | number | undefined) => void;

  kill(signal?: NodeJS.Signals | number): boolean {
    this.signals.push(signal);
    this.onKill?.(signal);
    return true;
  }

  asChildProcess(): ChildProcess {
    return this as unknown as ChildProcess;
  }
}

describe("extractBuildResourceUrls", () => {
  it("resolves Vite scripts and styles for web builds", () => {
    const html = `
      <link rel="stylesheet" href="/assets/index.css">
      <script type="module" src="/assets/index.js"></script>
    `;

    expect(extractBuildResourceUrls(html, "http://127.0.0.1:4174/")).toEqual([
      "http://127.0.0.1:4174/assets/index.js",
      "http://127.0.0.1:4174/assets/index.css",
    ]);
  });

  it("resolves relative resources emitted by desktop mode", () => {
    const html = `<script type="module" src="./assets/index.js"></script>`;
    expect(extractBuildResourceUrls(html, "http://127.0.0.1:4174/")).toEqual(["http://127.0.0.1:4174/assets/index.js"]);
  });
});

describe("smoke preview process lifecycle", () => {
  it("rejects invalid ports before spawning Vite", async () => {
    await expect(smokePreview({ port: 70_000 })).rejects.toThrow("Invalid ALCHEMY_SMOKE_PORT: 70000");
  });

  it("fails immediately when the child exits before readiness", async () => {
    const child = new FakeChildProcess();
    const watcher = watchChildProcess(child.asChildProcess());
    const neverReady = new Promise<Response>(() => undefined);

    queueMicrotask(() => child.emit("exit", 2, null));

    await expect(waitForProcessReady(neverReady, watcher, "vite preview")).rejects.toThrow(
      "vite preview exited before it became ready (code 2)",
    );
  });

  it("preserves spawn errors reported before readiness", async () => {
    const child = new FakeChildProcess();
    const watcher = watchChildProcess(child.asChildProcess());
    const spawnError = new Error("spawn failed");

    queueMicrotask(() => child.emit("error", spawnError));

    await expect(waitForProcessReady(new Promise(() => undefined), watcher, "vite preview")).rejects.toBe(spawnError);
  });

  it("stops gracefully when SIGTERM exits the child", async () => {
    const child = new FakeChildProcess();
    const watcher = watchChildProcess(child.asChildProcess());
    child.onKill = (signal) => {
      if (signal === "SIGTERM") queueMicrotask(() => child.emit("exit", null, signal));
    };

    await stopChildProcess(child.asChildProcess(), watcher, { graceMs: 1 });

    expect(child.signals).toEqual(["SIGTERM"]);
  });

  it("escalates to SIGKILL when the child ignores SIGTERM", async () => {
    const child = new FakeChildProcess();
    const watcher = watchChildProcess(child.asChildProcess());
    child.onKill = (signal) => {
      if (signal === "SIGKILL") queueMicrotask(() => child.emit("exit", null, signal));
    };

    await stopChildProcess(child.asChildProcess(), watcher, { graceMs: 1 });

    expect(child.signals).toEqual(["SIGTERM", "SIGKILL"]);
  });

  it("does not signal a child that already exited", async () => {
    const child = new FakeChildProcess();
    const watcher = watchChildProcess(child.asChildProcess());
    child.emit("exit", 0, null);

    await stopChildProcess(child.asChildProcess(), watcher, { graceMs: 1 });

    expect(child.signals).toEqual([]);
  });
});
