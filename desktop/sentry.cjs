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

module.exports = {
  initializeMainSentry,
};
