// Shared git helpers for release, changelog sync, and patch notes.
import { execFileSync } from "node:child_process";

const FIELD_SEPARATOR = "\x1f";
const RECORD_SEPARATOR = "\x1e";
const GIT_LOG_MAX_BUFFER = 16 * 1024 * 1024;

export const SEMVER_RE = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/;

export function assertValidSemver(version) {
  if (!SEMVER_RE.test(version)) throw new Error(`Invalid semantic version: ${version}`);
}

export function assertValidTag(tag) {
  if (tag === "HEAD") return;
  if (!/^v?\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/.test(tag)) {
    throw new Error(`Invalid tag revision: ${tag}`);
  }
}

export function listVersionTags(root) {
  try {
    const output = execFileSync("git", ["tag", "--list", "v*", "--sort=-v:refname"], {
      cwd: root,
      stdio: ["ignore", "pipe", "ignore"],
    })
      .toString()
      .trim();
    if (!output) return [];
    return output.split("\n").filter(Boolean);
  } catch {
    return [];
  }
}

export function latestVersionTag(root) {
  const tags = listVersionTags(root);
  return tags[0] ?? null;
}

export function previousVersionTag(root, currentTag) {
  const tags = listVersionTags(root);
  const normalized = currentTag.startsWith("v") ? currentTag : `v${currentTag}`;
  const index = tags.indexOf(normalized);
  if (index === -1) return tags[0] ?? null;
  return tags[index + 1] ?? null;
}

export function latestCommitHash(root, short = true) {
  try {
    const args = short ? ["rev-parse", "--short", "HEAD"] : ["rev-parse", "HEAD"];
    return execFileSync("git", args, {
      cwd: root,
      stdio: ["ignore", "pipe", "ignore"],
    })
      .toString()
      .trim();
  } catch {
    return "unknown";
  }
}

export function resolvePatchNoteRange(root, releaseTag) {
  if (!releaseTag) {
    return { since: latestVersionTag(root), until: "HEAD" };
  }
  const current = releaseTag.startsWith("v") ? releaseTag : `v${releaseTag}`;
  assertValidTag(current);
  return { since: previousVersionTag(root, current), until: current };
}

function parseCommitRecord(record) {
  const firstSep = record.indexOf(FIELD_SEPARATOR);
  if (firstSep === -1) {
    return { subject: record.trim(), body: "", files: [] };
  }

  const subject = record.slice(0, firstSep).trim();
  const rest = record.slice(firstSep + 1);
  const secondSep = rest.indexOf(FIELD_SEPARATOR);
  if (secondSep === -1) {
    return { subject, body: rest.trim(), files: [] };
  }

  const body = rest.slice(0, secondSep).trim();
  const files = rest
    .slice(secondSep + 1)
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
  return { subject, body, files };
}

export function getCommitsSinceTag(root, tag, options = {}) {
  const until = options.until ?? "HEAD";
  assertValidTag(until);
  if (tag) assertValidTag(tag);
  const range = tag ? `${tag}..${until}` : until;
  let output;
  try {
    output = execFileSync(
      "git",
      ["log", range, "--no-merges", "--pretty=format:%x1e%s%x1f%b%x1f", "--name-only", "--"],
      {
        cwd: root,
        stdio: ["ignore", "pipe", "ignore"],
        maxBuffer: GIT_LOG_MAX_BUFFER,
      },
    ).toString();
  } catch {
    return null;
  }

  if (!output.trim()) return [];

  return output
    .split(RECORD_SEPARATOR)
    .map((record) => record.trim())
    .filter(Boolean)
    .map(parseCommitRecord);
}
