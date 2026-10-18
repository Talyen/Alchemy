import type { RuntimeSnapshot } from "./report";

export interface RuntimeSample {
  elapsedMs: number;
  runtime: RuntimeSnapshot;
}

/** Serial reads avoid overlapping protocol requests and stop drains the last admitted read. */
export async function startRuntimeSampling(read: () => Promise<RuntimeSnapshot>, intervalMs = 1000) {
  const started = performance.now();
  const samples: RuntimeSample[] = [];
  let stopped = false;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let failure: unknown;
  let pending: Promise<void>;
  const capture = async () => {
    try {
      samples.push({ elapsedMs: performance.now() - started, runtime: await read() });
    } catch (error) {
      failure = error;
      stopped = true;
    }
    if (!stopped) timer = setTimeout(() => (pending = capture()), intervalMs);
  };
  pending = capture();
  await pending;
  return {
    async stop() {
      stopped = true;
      clearTimeout(timer);
      await pending;
      if (failure) throw failure;
      samples.push({ elapsedMs: performance.now() - started, runtime: await read() });
      return samples;
    },
  };
}

export function memoryRange(samples: RuntimeSample[], read: (snapshot: RuntimeSnapshot) => number | undefined) {
  const values = samples.flatMap(({ runtime }) => {
    const value = read(runtime);
    return value !== undefined && Number.isFinite(value) && value >= 0 ? [value] : [];
  });
  if (!values.length) return undefined;
  return { first: values[0]!, last: values.at(-1)!, peak: Math.max(...values) };
}
