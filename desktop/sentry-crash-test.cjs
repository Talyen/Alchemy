const path = require("node:path");

const CRASH_TEST_ARGUMENT = "--alchemy-sentry-test=";
const CRASH_TEST_MODES = new Set(["main", "renderer", "native-renderer"]);

function readDesktopMetadata(app) {
  try {
    return require(path.join(app.getAppPath(), "package.json"));
  } catch {
    return {};
  }
}

function resolveSentryCrashTestMode(app, crashReportingEnabled, argv = process.argv, injectedMetadata) {
  const metadata = injectedMetadata ?? readDesktopMetadata(app);
  if (!app.isPackaged || !crashReportingEnabled || metadata.sentryCrashTestEnabled !== true) return null;

  const requestedModes = argv
    .filter((argument) => argument.startsWith(CRASH_TEST_ARGUMENT))
    .map((argument) => argument.slice(CRASH_TEST_ARGUMENT.length));
  if (requestedModes.length !== 1 || !CRASH_TEST_MODES.has(requestedModes[0])) return null;
  return requestedModes[0];
}

function executeSentryCrashTest(
  window,
  mode,
  raise = (error) => {
    throw error;
  },
) {
  if (mode === "main") {
    raise(new Error("Alchemy controlled Sentry main-process crash"));
    return;
  }
  if (mode === "renderer") {
    void window.webContents
      .executeJavaScript('setTimeout(() => { throw new Error("Alchemy controlled Sentry renderer crash"); }, 0)', true)
      .catch(() => undefined);
    return;
  }
  if (mode === "native-renderer") window.webContents.forcefullyCrashRenderer();
}

function armSentryCrashTest(window, mode, scheduler = setTimeout, beforeCrash = () => undefined) {
  if (!mode) return false;
  window.webContents.once("did-finish-load", () => {
    scheduler(() => {
      void Promise.resolve(beforeCrash(mode)).then(
        () => scheduler(() => executeSentryCrashTest(window, mode), 0),
        () => scheduler(() => executeSentryCrashTest(window, mode), 0),
      );
    }, 1_500);
  });
  return true;
}

module.exports = {
  armSentryCrashTest,
  executeSentryCrashTest,
  resolveSentryCrashTestMode,
};
