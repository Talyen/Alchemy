import { afterEach, describe, expect, it, vi } from "vitest";
import { waitForHttp } from "../../scripts/lib/wait-for-http.mjs";
import { waitForDevServer } from "../../scripts/wait-dev-server.mjs";

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
