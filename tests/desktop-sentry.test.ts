import { createRequire } from "node:module";
import { describe, expect, it, vi } from "vitest";

const require = createRequire(import.meta.url);
interface MainSentryModule {
  initializeMainSentry: (
    app: { getAppPath: () => string; getVersion: () => string; isPackaged: boolean },
    sentry: { init: (options: Record<string, unknown>) => void },
    metadata: { sentryEnabled: boolean; sentryDsn: string },
  ) => boolean;
}
const mainSentry = require("../desktop/sentry.cjs") as MainSentryModule;

describe("desktop crash reporting", () => {
  it("stays disabled unless a packaged release explicitly enables it", () => {
    const init = vi.fn();
    const app = { getAppPath: () => ".", getVersion: () => "1.2.3", isPackaged: false };
    expect(
      mainSentry.initializeMainSentry(app, { init }, { sentryEnabled: true, sentryDsn: "https://public@example/1" }),
    ).toBe(false);
    expect(init).not.toHaveBeenCalled();
  });

  it("initializes non-fatally with basic error reporting", () => {
    const init = vi.fn();
    const app = { getAppPath: () => ".", getVersion: () => "1.2.3", isPackaged: true };
    expect(
      mainSentry.initializeMainSentry(app, { init }, { sentryEnabled: true, sentryDsn: "https://public@example/1" }),
    ).toBe(true);
    const options = init.mock.calls[0]?.[0] as {
      autoSessionTracking: boolean;
      sendDefaultPii: boolean;
      tracesSampleRate: number;
    };
    expect(options.autoSessionTracking).toBe(false);
    expect(options.sendDefaultPii).toBe(false);
    expect(options.tracesSampleRate).toBe(0);
    expect(options).not.toHaveProperty("beforeSend");
    expect(options).not.toHaveProperty("integrations");

    expect(mainSentry.initializeMainSentry(app, { init: () => void 0 }, { sentryEnabled: true, sentryDsn: "" })).toBe(
      false,
    );
    expect(
      mainSentry.initializeMainSentry(
        app,
        {
          init: () => {
            throw new Error("offline");
          },
        },
        { sentryEnabled: true, sentryDsn: "https://public@example/1" },
      ),
    ).toBe(false);
  });
});
