const path = require("node:path");

function readDesktopMetadata(app) {
  try {
    return require(path.join(app.getAppPath(), "package.json"));
  } catch {
    return {};
  }
}

function initializeMainSentry(app, injectedSentry, injectedMetadata) {
  const metadata = injectedMetadata ?? readDesktopMetadata(app);
  const dsn = typeof metadata.sentryDsn === "string" ? metadata.sentryDsn : "";
  if (!app.isPackaged || metadata.sentryEnabled !== true || !dsn) return false;

  try {
    const Sentry = injectedSentry ?? require("@sentry/electron/main");
    Sentry.init({
      autoSessionTracking: false,
      dsn,
      enableLogs: false,
      release: metadata.sentryRelease || `alchemy@${app.getVersion()}`,
      sendDefaultPii: false,
      tracesSampleRate: 0,
      initialScope: {
        tags: {
          electron: process.versions.electron,
          platform: process.platform,
          process: "main",
        },
      },
    });
    return true;
  } catch (error) {
    console.warn("Crash reporting could not be initialized:", error?.message ?? "unknown error");
    return false;
  }
}

async function flushSentryTestEvent(mode, injectedSentry) {
  try {
    const Sentry = injectedSentry ?? require("@sentry/electron/main");
    const eventId = Sentry.withScope((scope) => {
      scope.setTag("process", "main");
      scope.setTag("source", `crash-test-${mode}`);
      return Sentry.captureException(new Error("Alchemy controlled Sentry transport verification"));
    });
    return {
      eventId: typeof eventId === "string" ? eventId : null,
      flushed: (await Sentry.flush(5_000)) === true,
    };
  } catch {
    return { eventId: null, flushed: false };
  }
}

module.exports = {
  flushSentryTestEvent,
  initializeMainSentry,
};
