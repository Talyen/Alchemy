const SENTRY_CRASH_TEST_EVENT = "alchemy-sentry-crash-test";

type CrashTestTarget = Pick<Window, "addEventListener">;
type CrashTestScheduler = (callback: () => void, delay: number) => unknown;

export function throwControlledRendererCrash(): never {
  throw new Error("Alchemy controlled Sentry renderer crash");
}

export function armRendererSentryCrashTest(
  target: CrashTestTarget = window,
  scheduler: CrashTestScheduler = globalThis.setTimeout,
  desktopAvailable = Boolean(window.alchemyDesktop),
): boolean {
  if (!desktopAvailable) return false;
  target.addEventListener(
    SENTRY_CRASH_TEST_EVENT,
    () => {
      scheduler(throwControlledRendererCrash, 0);
    },
    { once: true },
  );
  return true;
}
