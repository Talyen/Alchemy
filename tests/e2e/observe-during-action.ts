import type { JSHandle } from "@playwright/test";

/** Consume a sampler armed in the renderer before input and release it even if input fails. */
export async function observeDuringAction<T>(
  observation: JSHandle<{ result: Promise<T>; cancel: () => void }>,
  action: () => Promise<void>,
): Promise<T> {
  try {
    await action();
    return await observation.evaluate(async ({ result }) => result);
  } finally {
    try {
      await observation.evaluate(({ cancel }) => cancel());
    } finally {
      await observation.dispose();
    }
  }
}
