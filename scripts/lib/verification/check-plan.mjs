import fs from "node:fs";
import path from "node:path";
import { filterPrettierPaths } from "./prettier-paths.mjs";
import { resolveRoutePlan } from "./change-routes.mjs";

/** One inspectable plan for source classification, coverage, and completion gates. */
export function resolveCheckPlan(
  paths,
  { rootDir, full = false, prePush = false, skipBuilds = false, verifyArgs = paths } = {},
) {
  const coverage = resolveRoutePlan(paths);
  const selection = coverage.classification;
  verifyArgs = full && selection.needsCodeChecks ? [...verifyArgs, "--skip-docs-check"] : verifyArgs;
  skipBuilds ||= !full;
  const ciReason = "CI-only in the default local gate";
  const buildReason = !full
    ? ciReason
    : skipBuilds
      ? "skipped via ALCHEMY_CHECK_SKIP_BUILD=1 (CI still builds)"
      : undefined;
  const webEnabled = selection.web && !skipBuilds;
  const desktopEnabled = selection.desktop && !skipBuilds;
  const formatPaths = filterPrettierPaths(paths).filter((file) =>
    fs.statSync(path.join(rootDir, file), { throwIfNoEntry: false })?.isFile(),
  );
  const smallFormatBatch =
    formatPaths.length > 0 &&
    formatPaths.length <= 50 &&
    formatPaths.every((file) => fs.statSync(path.join(rootDir, file)).size <= 256_000);
  const lintPaths = formatPaths.filter((file) => /\.[cm]?[jt]sx?$/u.test(file));
  const smallLintBatch =
    lintPaths.length > 0 &&
    lintPaths.length <= 50 &&
    lintPaths.every((file) => fs.statSync(path.join(rootDir, file)).size <= 256_000);
  const assetPush = prePush && coverage.routes.some((route) => route.id === "assets");
  const definitions = [
    {
      key: "asset-sources",
      label: assetPush ? "local asset source freshness" : "committed asset integrity",
      command: "npm",
      args: ["run", assetPush ? "assets:check" : "assets:check:outputs"],
      enabled: prePush,
    },
    {
      key: "localization",
      label: "localization freshness and contracts",
      command: "npm",
      args: ["run", "i18n:check"],
      enabled: full || selection.localization,
      reason: "localization inputs unchanged",
    },
    {
      key: "verification",
      label: "changed-path verification",
      command: "node",
      args: ["scripts/verify-changed.mjs", ...verifyArgs],
      enabled: true,
    },
    {
      key: "local-types",
      label: "source and test types",
      command: "npm",
      args: ["run", "typecheck:all"],
      enabled: false,
      reason: full ? "included in full static checks" : ciReason,
    },
    {
      key: "local-format",
      label: "selected-file format",
      command: "node",
      args: ["scripts/run-prettier.mjs", "--check", ...formatPaths],
      enabled: !full && smallFormatBatch,
      reason: full ? "included in full static checks" : "empty or large formatting batch deferred to CI",
    },
    {
      key: "local-lint",
      label: "selected-file lint",
      command: "node",
      args: ["scripts/run-compact.mjs", "oxlint", ...lintPaths, "--format", "stylish", "--max-warnings=0"],
      enabled: !full && smallLintBatch,
      reason: full ? "included in full static checks" : "empty or large lint batch deferred to CI",
    },
    {
      key: "documentation-format",
      label: "documentation format",
      command: "npm",
      args: ["run", "format:check"],
      enabled: full && !selection.needsCodeChecks,
      reason: !full ? ciReason : "included in static checks",
    },
    {
      key: "ci-static",
      label: "CI static checks",
      command: "npm",
      args: ["run", "lint:ci"],
      enabled: full && selection.needsCodeChecks,
      reason: !full ? ciReason : "documentation-only change",
    },
    {
      key: "lockfile",
      label: "lockfile consistency",
      command: "npm",
      args: ["ci", "--dry-run", "--ignore-scripts"],
      enabled: full && selection.lockfile,
      reason: !full ? ciReason : "package manifests unchanged",
    },
    {
      key: "web-build",
      label: "web build",
      command: "npm",
      args: ["run", "build"],
      enabled: webEnabled,
      reason: buildReason ?? "web runtime inputs unchanged",
    },
    {
      key: "web-bundle-budget",
      label: "web bundle budget",
      command: "npm",
      // Web and desktop renderer builds both write dist/ sequentially: each
      // budget step checks dist/ immediately after its own build, so the same
      // check:bundle command validates different outputs at different times.
      args: ["run", "check:bundle"],
      enabled: webEnabled,
      reason: buildReason ?? "web build not required",
    },
    {
      key: "preview-smoke",
      label: "preview smoke",
      command: "npm",
      args: ["run", "smoke:preview"],
      enabled: webEnabled,
      reason: buildReason ?? "web build not required",
    },
    {
      key: "desktop-build",
      label: "desktop build",
      command: "npm",
      args: ["run", "build:desktop"],
      enabled: desktopEnabled,
      reason: buildReason ?? "desktop inputs unchanged",
    },
    {
      key: "desktop-bundle-budget",
      label: "desktop bundle budget",
      command: "npm",
      // Same dist/ path as web by design: runs after desktop-build, so it
      // validates the desktop renderer output that just overwrote dist/.
      args: ["run", "check:bundle"],
      enabled: desktopEnabled,
      reason: buildReason ?? "desktop build not required",
    },
  ];
  return { paths: coverage.paths, selection, coverage, verifyArgs, steps: definitions };
}
