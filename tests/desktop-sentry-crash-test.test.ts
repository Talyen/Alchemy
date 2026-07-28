import { createRequire } from "node:module";
import { describe, expect, it, vi } from "vitest";

const require = createRequire(import.meta.url);
interface CrashTestModule {
  armSentryCrashTest: (
    window: { webContents: { once: (event: string, callback: () => void) => void } },
    mode: string | null,
    scheduler?: (callback: () => void, delay: number) => void,
    beforeCrash?: (mode: string) => Promise<void>,
  ) => boolean;
  executeSentryCrashTest: (
    window: {
      webContents: {
        executeJavaScript: (source: string, userGesture: boolean) => Promise<unknown>;
        forcefullyCrashRenderer: () => void;
      };
    },
    mode: string,
    raise?: (error: Error) => void,
  ) => void;
  resolveSentryCrashTestMode: (
    app: { getAppPath: () => string; isPackaged: boolean },
    crashReportingEnabled: boolean,
    argv: string[],
    metadata: { sentryCrashTestEnabled?: boolean },
  ) => string | null;
}
const crashTest = require("../desktop/sentry-crash-test.cjs") as CrashTestModule;

describe("Sentry packaged crash verification", () => {
  const packagedApp = { getAppPath: () => ".", isPackaged: true };

  it("requires packaged reporting, test metadata, and exactly one supported argument", () => {
    const metadata = { sentryCrashTestEnabled: true };
    expect(
      crashTest.resolveSentryCrashTestMode(
        packagedApp,
        true,
        ["Alchemy.exe", "--alchemy-sentry-test=renderer"],
        metadata,
      ),
    ).toBe("renderer");
    expect(
      crashTest.resolveSentryCrashTestMode(
        { ...packagedApp, isPackaged: false },
        true,
        ["Alchemy.exe", "--alchemy-sentry-test=renderer"],
        metadata,
      ),
    ).toBeNull();
    expect(
      crashTest.resolveSentryCrashTestMode(
        packagedApp,
        false,
        ["Alchemy.exe", "--alchemy-sentry-test=renderer"],
        metadata,
      ),
    ).toBeNull();
    expect(
      crashTest.resolveSentryCrashTestMode(packagedApp, true, ["Alchemy.exe", "--alchemy-sentry-test=renderer"], {}),
    ).toBeNull();
    expect(
      crashTest.resolveSentryCrashTestMode(
        packagedApp,
        true,
        ["Alchemy.exe", "--alchemy-sentry-test=unknown"],
        metadata,
      ),
    ).toBeNull();
  });

  it("arms only an explicit mode after the renderer finishes loading and transport flush", async () => {
    let onLoad: (() => void) | undefined;
    const scheduled: Array<() => void> = [];
    const scheduler = vi.fn((callback: () => void) => {
      scheduled.push(callback);
    });
    const beforeCrash = vi.fn(async () => undefined);
    const window = {
      webContents: {
        once: vi.fn((_event: string, callback: () => void) => {
          onLoad = callback;
        }),
      },
    };
    expect(crashTest.armSentryCrashTest(window, null, scheduler)).toBe(false);
    expect(window.webContents.once).not.toHaveBeenCalled();
    expect(crashTest.armSentryCrashTest(window, "main", scheduler, beforeCrash)).toBe(true);
    expect(window.webContents.once).toHaveBeenCalledWith("did-finish-load", expect.any(Function));
    onLoad?.();
    expect(scheduler).toHaveBeenCalledWith(expect.any(Function), 1_500);
    scheduled.shift()?.();
    await Promise.resolve();
    expect(beforeCrash).toHaveBeenCalledWith("main");
    expect(scheduler).toHaveBeenLastCalledWith(expect.any(Function), 0);
  });

  it("keeps the three crash mechanisms distinct", async () => {
    const executeJavaScript = vi.fn().mockResolvedValue(undefined);
    const forcefullyCrashRenderer = vi.fn();
    const window = { webContents: { executeJavaScript, forcefullyCrashRenderer } };
    const raise = vi.fn();

    crashTest.executeSentryCrashTest(window, "main", raise);
    expect(raise).toHaveBeenCalledWith(expect.objectContaining({ message: expect.stringContaining("main-process") }));

    crashTest.executeSentryCrashTest(window, "renderer");
    expect(executeJavaScript).toHaveBeenCalledWith(expect.stringContaining("renderer crash"), true);

    crashTest.executeSentryCrashTest(window, "native-renderer");
    expect(forcefullyCrashRenderer).toHaveBeenCalledOnce();
  });
});
