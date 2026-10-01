type Cleanup = () => void;
type Schedule = (callback: () => void) => Cleanup;

export interface PlaybackTask<T> {
  complete: (value: T, onComplete?: () => void) => void;
  own: (cleanup: Cleanup) => void;
  schedule: (schedule: Schedule, callback: () => void) => void;
  frame: (callback: () => void) => void;
}

/** A single settlement boundary for a presentation operation and its resources. */
export function runPlaybackTask<T>(
  registerCancel: (callback: () => void) => Cleanup,
  cancelledValue: () => T,
  start: (task: PlaybackTask<T>) => void,
): Promise<T> {
  return new Promise((resolve, reject) => {
    let active = true;
    const cleanups = new Set<Cleanup>();

    function releaseAll() {
      const errors: unknown[] = [];
      for (const cleanup of cleanups) {
        try {
          cleanup();
        } catch (error) {
          errors.push(error);
        }
      }
      cleanups.clear();
      if (errors.length > 0) throw new AggregateError(errors, "Battle playback cleanup failed");
    }

    function settle(value: () => T, onComplete?: () => void) {
      if (!active) return;
      active = false;
      try {
        releaseAll();
        const result = value();
        onComplete?.();
        resolve(result);
      } catch (error) {
        reject(error instanceof Error ? error : new Error("Battle playback task failed", { cause: error }));
      }
    }

    function fail(error: unknown) {
      if (!active) return;
      active = false;
      try {
        releaseAll();
      } catch (cleanupError) {
        reject(new AggregateError([error, cleanupError], "Battle playback task failed"));
        return;
      }
      reject(error instanceof Error ? error : new Error("Battle playback task failed", { cause: error }));
    }

    function own(cleanup: Cleanup) {
      // Registration and scheduling seams may settle synchronously, before
      // returning their cleanup. Late resources must still be released.
      if (active) cleanups.add(cleanup);
      else cleanup();
    }

    function schedule(scheduleCallback: Schedule, callback: () => void) {
      if (!active) return;
      let fired = false;
      const scheduled: { clear?: Cleanup } = {};
      const cleanup = scheduleCallback(() => {
        if (fired || !active) return;
        fired = true;
        if (scheduled.clear) cleanups.delete(scheduled.clear);
        try {
          callback();
        } catch (error) {
          fail(error);
        }
      });
      scheduled.clear = cleanup;
      if (fired) cleanup();
      else own(cleanup);
    }

    const task: PlaybackTask<T> = {
      complete: (value, onComplete) => settle(() => value, onComplete),
      own,
      schedule,
      frame: (callback) =>
        schedule((tick) => {
          const frame = requestAnimationFrame(tick);
          return () => cancelAnimationFrame(frame);
        }, callback),
    };

    try {
      own(registerCancel(() => settle(cancelledValue)));
      if (active) start(task);
    } catch (error) {
      fail(error);
    }
  });
}
