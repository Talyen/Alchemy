import { afterEach, describe, expect, it, vi } from "vitest";
import { waitForHttp } from "../../scripts/lib/wait-for-http.mjs";
import { waitForDevServer } from "../../scripts/wait-dev-server.mjs";

// Keep the polling delay and Date.now on the same fake clock.
vi.mock("node:timers/promises", () => ({
  setTimeout: (ms: number) =>
    new Promise<void>((resolve) => {
      globalThis.setTimeout(resolve, ms);
    }),
}));

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("waitForHttp", () => {
  it("waits through Vite errors before desktop startup and releases every response", async () => {
    vi.useFakeTimers();
    const failed = new Response("Vite is not ready", { status: 503 });
    const ready = new Response("<html>Alchemy</html>");
    const fetch = vi.fn().mockResolvedValueOnce(failed).mockResolvedValueOnce(ready);
    vi.stubGlobal("fetch", fetch);
    const waiting = waitForDevServer({ port: 5173 });
    await vi.advanceTimersByTimeAsync(0);
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(failed.bodyUsed).toBe(true);
    await vi.advanceTimersByTimeAsync(250);
    await waiting;
    expect(fetch).toHaveBeenCalledTimes(2);
    expect(ready.bodyUsed).toBe(true);
  });

  it("rejects invalid timer settings before attempting a request", async () => {
    const fetch = vi.fn();
    vi.stubGlobal("fetch", fetch);
    for (const name of ["timeoutMs", "pollMs", "requestTimeoutMs"]) {
      for (const value of [NaN, Infinity, -1, 1.5, 2_147_483_648]) {
        await expect(waitForHttp("http://localhost:1234", { [name]: value })).rejects.toThrow(name);
      }
    }
    await expect(waitForHttp("http://localhost:1234", { requestTimeoutMs: 0 })).rejects.toThrow("requestTimeoutMs");
    expect(fetch).not.toHaveBeenCalled();
  });

  it("reports the latest rejected HTTP status instead of an earlier network error", async () => {
    vi.useFakeTimers();
    const failed = new Response("not ready", { status: 503, statusText: "Service Unavailable" });
    vi.stubGlobal("fetch", vi.fn().mockRejectedValueOnce(new Error("offline")).mockResolvedValueOnce(failed));
    const waiting = waitForHttp("http://localhost:1234", { timeoutMs: 20, pollMs: 10 });
    const outcome = waiting.catch((error: unknown) => error);
    await vi.advanceTimersByTimeAsync(20);
    const error = await outcome;
    expect(error).toEqual(
      expect.objectContaining({ message: expect.stringContaining("HTTP 503 Service Unavailable") }),
    );
    expect(String(error)).not.toContain("offline");
    expect(failed.bodyUsed).toBe(true);
  });

  it("does not sleep beyond the remaining deadline", async () => {
    vi.useFakeTimers();
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new Error("offline");
      }),
    );
    const waiting = waitForHttp("http://localhost:1234", { timeoutMs: 100, pollMs: 1000 });
    const outcome = waiting.catch((error: unknown) => error);
    await vi.advanceTimersByTimeAsync(100);
    expect(await outcome).toEqual(
      expect.objectContaining({ message: expect.stringContaining("Timed out after 0.1s") }),
    );
  });

  it.each(["rejected status", "throwing validation"])(
    "releases response bodies after %s before retrying",
    async (failure) => {
      vi.useFakeTimers();
      const cancel = vi.fn(async () => {});
      vi.stubGlobal(
        "fetch",
        vi.fn(async () => ({ ok: false, body: { cancel } })),
      );
      const waiting = waitForHttp("http://localhost:1234", {
        timeoutMs: 10,
        pollMs: 10,
        accept: (response) => {
          if (failure === "throwing validation") throw new Error("invalid response");
          return response.ok;
        },
      });
      const outcome = waiting.catch((error: unknown) => error);
      await vi.advanceTimersByTimeAsync(10);
      expect(await outcome).toEqual(expect.objectContaining({ message: expect.stringContaining("Timed out") }));
      expect(cancel).toHaveBeenCalledOnce();
    },
  );
});
