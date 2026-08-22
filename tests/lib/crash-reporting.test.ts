import { beforeEach, describe, expect, it, vi } from "vitest";

const sentryMocks = vi.hoisted(() => ({
  init: vi.fn(),
  setTags: vi.fn(),
  withScope: vi.fn(),
  captureException: vi.fn(),
}));

vi.mock("@sentry/electron/renderer", () => sentryMocks);

import { initializeRendererCrashReporting } from "@/lib/crash-reporting";
import { logError, resetErrorSinksForTests } from "@/lib/error-logger";

interface WindowWithDesktop {
  alchemyDesktop?: { crashReportingEnabled?: boolean };
}

function setCrashReportingEnabled(enabled: boolean | undefined) {
  (window as unknown as WindowWithDesktop).alchemyDesktop = { crashReportingEnabled: enabled };
}

describe("initializeRendererCrashReporting", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetErrorSinksForTests();
    delete (window as unknown as WindowWithDesktop).alchemyDesktop;
  });

  it("reports false outside desktop builds without touching Sentry", () => {
    expect(initializeRendererCrashReporting()).toBe(false);
    expect(sentryMocks.init).not.toHaveBeenCalled();
  });

  it("returns false when the desktop bridge has crash reporting off", () => {
    setCrashReportingEnabled(false);
    expect(initializeRendererCrashReporting()).toBe(false);
    expect(sentryMocks.init).not.toHaveBeenCalled();
  });

  it("initializes Sentry and registers a renderer error sink on desktop", () => {
    setCrashReportingEnabled(true);
    sentryMocks.withScope.mockImplementation((callback: (scope: object) => void) => callback({ setTag: vi.fn() }));

    expect(initializeRendererCrashReporting()).toBe(true);
    expect(sentryMocks.init).toHaveBeenCalledOnce();
    expect(sentryMocks.setTags).toHaveBeenCalledWith(expect.objectContaining({ process: "renderer" }));

    logError("boom", "react", { screen: "battle" }, undefined, undefined, new Error("render exploded"));
    expect(sentryMocks.captureException).toHaveBeenCalledWith(expect.objectContaining({ message: "render exploded" }));
  });

  it("ignores non-react error sources", () => {
    setCrashReportingEnabled(true);
    sentryMocks.withScope.mockImplementation((callback: (scope: object) => void) => callback({ setTag: vi.fn() }));
    initializeRendererCrashReporting();

    logError("storage hiccup", "storage");
    expect(sentryMocks.captureException).not.toHaveBeenCalled();
  });
});
