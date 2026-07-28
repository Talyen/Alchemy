import { createRequire } from "node:module";
import { describe, expect, it, vi } from "vitest";

import { scrubRendererEvent } from "@/lib/crash-reporting";

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

  it("initializes non-fatally and installs a fail-closed scrubber", () => {
    const init = vi.fn();
    const app = { getAppPath: () => ".", getVersion: () => "1.2.3", isPackaged: true };
    expect(
      mainSentry.initializeMainSentry(app, { init }, { sentryEnabled: true, sentryDsn: "https://public@example/1" }),
    ).toBe(true);
    const options = init.mock.calls[0]?.[0] as {
      beforeSend: (event: Record<string, unknown>) => Record<string, unknown> | null;
      sendDefaultPii: boolean;
      tracesSampleRate: number;
    };
    expect(options.sendDefaultPii).toBe(false);
    expect(options.tracesSampleRate).toBe(0);
    expect(options.beforeSend({ user: { id: "steam-id" }, request: { headers: { secret: "x" } } })).toEqual({
      event_id: undefined,
      exception: undefined,
      level: undefined,
      platform: undefined,
      release: undefined,
      tags: {},
      timestamp: undefined,
    });

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

  it("removes PII fields and absolute paths from renderer events", () => {
    const scrubbed = scrubRendererEvent({
      user: { id: "steam-id" },
      request: { url: "https://example.invalid/?token=secret" },
      tags: { source: "react", steamName: "Player" },
      exception: {
        values: [
          {
            type: "Error",
            value: "failed at /Users/player/save.json",
            stacktrace: { frames: [{ filename: "C:\\Users\\player\\game.js", lineno: 10 }] },
          },
        ],
      },
    });
    expect(scrubbed).not.toHaveProperty("user");
    expect(scrubbed).not.toHaveProperty("request");
    expect(scrubbed?.tags).toEqual({ source: "react" });
    expect(JSON.stringify(scrubbed)).not.toContain("player");
  });
});
