import { readRepoPackageJson } from "./repo-package.mjs";

/** Single owner for the Sentry release name used by Vite upload and desktop metadata. */
export function resolveSentryRelease(env = process.env) {
  const explicit = env.SENTRY_RELEASE?.trim();
  if (explicit) return explicit;
  return `alchemy@${readRepoPackageJson().version}`;
}

/** Hidden maps for packaged desktop only; web and fast local iteration ship none. */
export function resolveSourcemapMode(mode, env = process.env) {
  if (env.ALCHEMY_SKIP_SOURCEMAP === "1") return false;
  return mode === "desktop" ? "hidden" : false;
}
