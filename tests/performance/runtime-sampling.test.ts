import { afterEach, expect, it, vi } from "vitest";
import { memoryRange, startRuntimeSampling } from "../../performance/runtime-sampling";

const runtime = { domNodes: 100, images: 2, canvases: 0, audioElements: 0 };
afterEach(() => vi.useRealTimers());

it("drains an admitted sample before stop and never samples after teardown", async () => {
  vi.useFakeTimers();
  let release!: () => void;
  const pending = new Promise<void>((resolve) => {
    release = resolve;
  });
  const read = vi
    .fn()
    .mockResolvedValue(runtime)
    .mockImplementationOnce(async () => runtime)
    .mockImplementationOnce(async () => {
      await pending;
      return runtime;
    });
  const sampler = await startRuntimeSampling(read);
  await vi.advanceTimersByTimeAsync(1000);
  let done = false;
  const stopped = sampler.stop().then((samples) => {
    done = true;
    return samples;
  });
  await Promise.resolve();
  expect(done).toBe(false);
  release();
  expect(await stopped).toHaveLength(3);
  await vi.advanceTimersByTimeAsync(5000);
  expect(read).toHaveBeenCalledTimes(3);
  expect(vi.getTimerCount()).toBe(0);
});

it("surfaces sampling failure instead of reporting missing measurements as zero RAM", async () => {
  vi.useFakeTimers();
  const read = vi.fn().mockResolvedValueOnce(runtime).mockRejectedValueOnce(new Error("renderer closed"));
  const sampler = await startRuntimeSampling(read);
  await vi.advanceTimersByTimeAsync(1000);
  await expect(sampler.stop()).rejects.toThrow("renderer closed");
  expect(vi.getTimerCount()).toBe(0);
  expect(memoryRange([{ elapsedMs: 0, runtime }], (snapshot) => snapshot.jsHeapUsedBytes)).toBeUndefined();
});
