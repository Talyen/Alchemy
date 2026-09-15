/** Shared Markdown link/heading/fence helpers for docs tooling.
 *
 * Single owner for fence tracking and heading slugs so link checks, plan
 * archiving, and discovery section reads cannot drift apart again.
 */

/** Matches a fenced-code-block delimiter (` ``` ` or ` ~~~ `, up to 3 spaces indent). */
const FENCE_MARKER_RE = /^ {0,3}(`{3,}|~{3,})/u;

export function extractMarkdownLinkTargets(source) {
  const targets = [];
  for (const match of source.matchAll(/\[[^\]]*\]\(([^)]+)\)/gu)) {
    const target = match[1]?.split(/\s+/u)[0]?.replace(/^<|>$/gu, "");
    if (!target) continue;
    targets.push({ target, index: match.index ?? 0 });
  }
  return targets;
}

function githubHeadingSlug(title) {
  return title
    .toLowerCase()
    .replaceAll(/<[^>]*>/gu, "")
    .replaceAll(/[\u2000-\u206F\u2E00-\u2E7F\\'!"#$%&()*+,./:;<=>?@[\]^`{|}~]/gu, "")
    .replaceAll(/\s/gu, "-");
}

function headingPlainText(raw) {
  return raw
    .replaceAll(/\[([^\]]+)\]\([^)]+\)/gu, "$1")
    .replaceAll(/\[([^\]]+)\]\[[^\]]*\]/gu, "$1")
    .replaceAll(/`([^`]+)`/gu, "$1")
    .replaceAll(/\*/gu, "")
    .trim();
}

/** GitHub-style slugs for every heading outside fenced blocks, with `-N` dedup suffixes. */
export function headingSlugs(source) {
  const slugs = new Set();
  const seen = new Map();
  let inFence = false;
  for (const line of source.split("\n")) {
    if (/^\s{0,3}(?:```|~~~)/u.test(line)) {
      inFence = !inFence;
      continue;
    }
    if (inFence) continue;
    const match = /^(#{1,6})\s+(.+?)\s*#*\s*$/u.exec(line);
    if (!match?.[2]) continue;
    const base = githubHeadingSlug(headingPlainText(match[2]));
    if (!base) continue;
    const count = seen.get(base) ?? 0;
    seen.set(base, count + 1);
    slugs.add(count === 0 ? base : `${base}-${count}`);
  }
  return slugs;
}

/** Source with fenced code blocks removed (backticked paths inside examples are not repo refs). */
export function stripFencedBlocks(source) {
  const kept = [];
  let inFence = false;
  for (const line of source.split("\n")) {
    if (/^\s{0,3}(?:```|~~~)/u.test(line)) inFence = !inFence;
    else if (!inFence) kept.push(line);
  }
  return kept.join("\n");
}

/** Map non-fence lines through `fn`, preserving fence blocks and original newlines. */
export function mapUnfencedLines(content, fn) {
  let fence = null;
  return content
    .split(/(\r?\n)/u)
    .map((line) => {
      if (/^\r?\n$/u.test(line)) return line;
      const marker = FENCE_MARKER_RE.exec(line)?.[1];
      if (marker) {
        if (!fence) fence = marker;
        else if (marker[0] === fence[0] && marker.length >= fence.length) fence = null;
        return line;
      }
      if (fence) return line;
      return fn(line);
    })
    .join("");
}
