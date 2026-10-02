import type { AutoplayCardControl } from "./battle-context";
import { resolveGameDelay } from "@/lib/animation/game-timer";

interface AutoplayAction {
  play: (control: AutoplayCardControl) => boolean | Promise<boolean>;
  canCommit: () => boolean;
}

export interface DriveAutoplayDeps {
  signal: AbortSignal;
  isEnabled: () => boolean;
  findAction: () => AutoplayAction | null;
  delayMs: number;
  postPlayDelayMs: number;
  wakeRef?: { current: (() => void) | null } | undefined;
}

async function waitForAutoplayRetry(
  delayMs: number,
  signal: AbortSignal,
  wakeRef?: { current: (() => void) | null },
): Promise<void> {
  if (signal.aborted) return;
  if (delayMs <= 0) {
    await Promise.resolve();
    return;
  }
  await new Promise<void>((resolve) => {
    let settled = false;
    const finish = () => {
      if (settled) return;
      settled = true;
      clearTimeout(handle);
      signal.removeEventListener("abort", onAbort);
      if (wakeRef?.current === finish) wakeRef.current = null;
      resolve();
    };
    const onAbort = finish;
    const handle = setTimeout(finish, delayMs);
    if (wakeRef) wakeRef.current = finish;
    signal.addEventListener("abort", onAbort, { once: true });
  });
}

/** Schedules ready actions; selection and playback eligibility belong to the caller. */
export async function driveAutoplay(deps: DriveAutoplayDeps): Promise<void> {
  const retryDelayMs = resolveGameDelay(deps.delayMs);
  const isActive = () => !deps.signal.aborted && deps.isEnabled();
  while (isActive()) {
    const action = deps.findAction();
    const playStartedAt = performance.now();
    if (!action || !(await action.play({ signal: deps.signal, canCommit: () => isActive() && action.canCommit() }))) {
      await waitForAutoplayRetry(retryDelayMs, deps.signal, deps.wakeRef);
      continue;
    }
    // Readiness notifications cannot shorten pacing. The next selection checks
    // live gates after this deadline, so transfers count toward the pause.
    const remainingMs = Math.max(0, resolveGameDelay(deps.postPlayDelayMs) - (performance.now() - playStartedAt));
    await waitForAutoplayRetry(remainingMs, deps.signal);
  }
}
