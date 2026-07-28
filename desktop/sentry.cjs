const path = require("node:path");

const ABSOLUTE_PATH_PATTERN = /(?:[A-Za-z]:\\|\/Users\/|\/home\/|\/var\/|\/tmp\/)[^\s"'<>]+/g;
const ALLOWED_TAGS = new Set(["electron", "platform", "process", "source", "screen"]);

function scrubText(value) {
  return typeof value === "string" ? value.replace(ABSOLUTE_PATH_PATTERN, "[local-path]") : value;
}

function scrubException(exception) {
  if (!exception || typeof exception !== "object") return exception;
  return {
    values: Array.isArray(exception.values)
      ? exception.values.map((value) => ({
          mechanism: value?.mechanism,
          stacktrace: value?.stacktrace
            ? {
                frames: value.stacktrace.frames?.map((frame) => ({
                  colno: frame.colno,
                  filename: scrubText(frame.filename),
                  function: frame.function,
                  in_app: frame.in_app,
                  lineno: frame.lineno,
                })),
              }
            : undefined,
          type: scrubText(value?.type),
        }))
      : undefined,
  };
}

function scrubEvent(event) {
  try {
    const tags = {};
    for (const [key, value] of Object.entries(event.tags ?? {})) {
      if (ALLOWED_TAGS.has(key) && (typeof value === "string" || typeof value === "number")) {
        tags[key] = scrubText(String(value));
      }
    }
    return {
      event_id: event.event_id,
      exception: scrubException(event.exception),
      level: event.level,
      platform: event.platform,
      release: event.release,
      tags,
      timestamp: event.timestamp,
    };
  } catch {
    return null;
  }
}

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
      attachScreenshot: false,
      autoSessionTracking: false,
      beforeSend: scrubEvent,
      dataCollection: { userInfo: false },
      dsn,
      enableLogs: false,
      enableRendererProfiling: false,
      integrations: (defaults) =>
        defaults.filter((integration) =>
          [
            "SentryMinidump",
            "OnUncaughtException",
            "PreloadInjection",
            "InboundFilters",
            "FunctionToString",
            "LinkedErrors",
            "OnUnhandledRejection",
            "NormalizePaths",
          ].includes(integration.name),
        ),
      maxBreadcrumbs: 0,
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
  scrubEvent,
  scrubText,
};
