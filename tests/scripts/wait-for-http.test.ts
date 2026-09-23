import { afterEach, describe, expect, it, vi } from "vitest";
import { waitForHttp } from "../../scripts/lib/wait-for-http.mjs";

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("waitForHttp", () => {
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

  it("releases rejected response bodies before retrying", async () => {
    vi.useFakeTimers();
    const cancel = vi.fn(async () => {});
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({ ok: false, body: { cancel } })),
    );
    const waiting = waitForHttp("http://localhost:1234", { timeoutMs: 10, pollMs: 10 });
    const outcome = waiting.catch((error: unknown) => error);
    await vi.advanceTimersByTimeAsync(10);
    expect(await outcome).toEqual(expect.objectContaining({ message: expect.stringContaining("Timed out") }));
    expect(cancel).toHaveBeenCalledOnce();
  });
});
