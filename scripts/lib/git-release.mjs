// Shared git helpers for release, changelog sync, and patch notes.
import { execSync } from "node:child_process";

const FIELD_SEPARATOR = "\x1f";
const RECORD_SEPARATOR = "\x1e";

export function listVersionTags(root) {
  try {
    const output = execSync('git tag --list "v*" --sort=-v:refname', {
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

export function getCommitsSinceTag(root, tag) {
  const range = tag ? `${tag}..HEAD` : "HEAD";
  let output;
  try {
    output = execSync(`git log ${range} --format=%s%x1f%b%x1e`, {
      cwd: root,
      stdio: ["ignore", "pipe", "ignore"],
    }).toString();
  } catch {
    return [];
  }

  if (!output.trim()) return [];

  return output
    .split(RECORD_SEPARATOR)
    .map((record) => record.trim())
    .filter(Boolean)
    .map((record) => {
      const separator = record.indexOf(FIELD_SEPARATOR);
      if (separator === -1) {
        return { subject: record.trim(), body: "" };
      }
      return {
        subject: record.slice(0, separator).trim(),
        body: record.slice(separator + 1).trim(),
      };
    });
}
