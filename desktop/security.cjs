const path = require("node:path");

const APP_PROTOCOL = "alchemy";
const APP_HOST = "app";
const APP_ORIGIN = `${APP_PROTOCOL}://${APP_HOST}`;
const MAX_SAVE_PAYLOAD_BYTES = 4 * 1024 * 1024;
const MAX_RICH_PRESENCE_KEY_LEN = 64;
const MAX_RICH_PRESENCE_VALUE_LEN = 256;

const PACKAGED_CSP = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self'",
  "media-src 'self' blob:",
  "connect-src 'none'",
  "object-src 'none'",
  "frame-src 'none'",
  "base-uri 'none'",
  "form-action 'none'",
].join("; ");

function parseDevServerUrl(rawUrl) {
  const parsed = new URL(rawUrl);
  if (parsed.protocol !== "http:" || parsed.hostname !== "127.0.0.1") {
    throw new Error(`Electron renderer URL must use http://127.0.0.1: ${rawUrl}`);
  }
  if (parsed.username || parsed.password || parsed.pathname !== "/" || parsed.search || parsed.hash) {
    throw new Error(`Electron renderer URL must be a bare loopback origin: ${rawUrl}`);
  }
  return parsed;
}

function isAllowedRendererUrl(rawUrl, { packaged, devServerUrl }) {
  try {
    const parsed = new URL(rawUrl);
    if (packaged) {
      return parsed.protocol === `${APP_PROTOCOL}:` && parsed.host === APP_HOST && !parsed.username && !parsed.password;
    }
    return !parsed.username && !parsed.password && parsed.origin === parseDevServerUrl(devServerUrl).origin;
  } catch {
    return false;
  }
}

function resolveAppAssetPath(rendererRoot, rawUrl) {
  const rawPath = rawUrl.slice(rawUrl.indexOf("/", `${APP_PROTOCOL}://`.length + APP_HOST.length));
  let decodedRawPath;
  try {
    decodedRawPath = decodeURIComponent(rawPath.split(/[?#]/, 1)[0] ?? "");
  } catch {
    return null;
  }
  if (
    decodedRawPath.includes("\0") ||
    decodedRawPath.includes("\\") ||
    decodedRawPath.split("/").some((segment) => segment === "..")
  ) {
    return null;
  }

  let parsed;
  try {
    parsed = new URL(rawUrl);
  } catch {
    return null;
  }
  if (parsed.protocol !== `${APP_PROTOCOL}:` || parsed.host !== APP_HOST) return null;

  let decodedPath;
  try {
    decodedPath = decodeURIComponent(parsed.pathname);
  } catch {
    return null;
  }
  if (decodedPath.includes("\0") || decodedPath.includes("\\")) return null;

  const relativeRequest = decodedPath === "/" ? "index.html" : decodedPath.replace(/^\/+/, "");
  const normalizedRoot = path.resolve(rendererRoot);
  const candidate = path.resolve(normalizedRoot, relativeRequest);
  const relative = path.relative(normalizedRoot, candidate);
  if (relative === "" || relative.startsWith(`..${path.sep}`) || relative === ".." || path.isAbsolute(relative)) {
    return null;
  }
  return candidate;
}

function isAuthorizedIpcEvent(event, mainWindow, rendererPolicy) {
  if (!mainWindow || mainWindow.isDestroyed()) return false;
  if (event.sender !== mainWindow.webContents) return false;
  if (!event.senderFrame || event.senderFrame !== event.sender.mainFrame) return false;
  return isAllowedRendererUrl(event.senderFrame.url, rendererPolicy);
}

function assertAuthorizedIpcEvent(event, mainWindow, rendererPolicy) {
  if (!isAuthorizedIpcEvent(event, mainWindow, rendererPolicy)) {
    throw new Error("Unauthorized Electron IPC sender");
  }
}

function isDisplayMode(value) {
  return value === "windowed" || value === "borderless-fullscreen" || value === "fullscreen";
}

function isSavePayload(data) {
  return typeof data === "string" && Buffer.byteLength(data, "utf8") <= MAX_SAVE_PAYLOAD_BYTES;
}

function isRichPresenceKey(key) {
  return typeof key === "string" && key.length > 0 && key.length <= MAX_RICH_PRESENCE_KEY_LEN;
}

function isRichPresenceValue(value) {
  return typeof value === "string" && value.length <= MAX_RICH_PRESENCE_VALUE_LEN;
}

module.exports = {
  APP_HOST,
  APP_ORIGIN,
  APP_PROTOCOL,
  MAX_SAVE_PAYLOAD_BYTES,
  PACKAGED_CSP,
  assertAuthorizedIpcEvent,
  isAllowedRendererUrl,
  isAuthorizedIpcEvent,
  isDisplayMode,
  isRichPresenceKey,
  isRichPresenceValue,
  isSavePayload,
  parseDevServerUrl,
  resolveAppAssetPath,
};
