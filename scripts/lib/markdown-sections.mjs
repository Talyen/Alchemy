/** Shared Markdown link/heading/fence/section helpers for docs tooling.
 *
 * Single owner for fence tracking, heading slugs, and document section reads
 * so link checks, plan archiving, and discovery section reads cannot drift
 * apart again.
 */
import fs from "node:fs";
import path from "node:path";

/** Matches a fenced-code-block delimiter (` ``` ` or ` ~~~ `, up to 3 spaces indent). */
const FENCE_MARKER_RE = /^ {0,3}(`{3,}|~{3,})/u;

/**
 * Length-aware fence tracker shared by every helper in this module. A fence
 * only closes on the same character with an equal or longer run, so a `~~~`
 * block is never closed by ` ``` ` and nested ```` ```` ```` blocks behave.
 * Returns the updated fence state (`null` when outside a fence).
 */
function trackFenceLine(line, fence) {
  const marker = FENCE_MARKER_RE.exec(line)?.[1];
  if (!marker) return fence;
  if (!fence) return marker;
  if (marker[0] === fence[0] && marker.length >= fence.length) return null;
  return fence;
}

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
  let fence = null;
  for (const line of source.split("\n")) {
    fence = trackFenceLine(line, fence);
    if (FENCE_MARKER_RE.test(line)) continue;
    if (fence) continue;
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
  let fence = null;
  for (const line of source.split("\n")) {
    const isMarker = FENCE_MARKER_RE.test(line);
    fence = trackFenceLine(line, fence);
    if (!isMarker && !fence) kept.push(line);
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
      const wasMarker = FENCE_MARKER_RE.test(line);
      fence = trackFenceLine(line, fence);
      if (wasMarker || fence) return line;
      return fn(line);
    })
    .join("");
}

/** Read a heading-delimited section of a repo document, ignoring headings inside fenced blocks. */
export function readDocumentSection(rootDir, relativePath, heading = null) {
  const source = fs.readFileSync(path.join(rootDir, relativePath), "utf8");
  const lines = source.split(/\r?\n/u);
  let fence = null;
  const headings = lines.flatMap((line, index) => {
    fence = trackFenceLine(line, fence);
    if (FENCE_MARKER_RE.test(line) || fence) return [];
    const match = /^(#{1,6})\s+(.+?)\s*#*\s*$/u.exec(line);
    return match ? [{ index, level: match[1].length, title: match[2] }] : [];
  });
  let start = 0;
  let end = lines.length;
  if (heading) {
    const selected = headings.find((entry) => entry.title === heading);
    if (!selected) throw new Error(`Context heading is missing: ${relativePath} -> ${heading}`);
    start = selected.index;
    end = headings.find((entry) => entry.index > start && entry.level <= selected.level)?.index ?? lines.length;
  }
  return { path: relativePath, heading, start: start + 1, end, text: lines.slice(start, end).join("\n") };
}

/** Remove table alignment padding only; retain line numbers, fences and cell content. */
export function compactMarkdownTables(source) {
  return mapUnfencedLines(source, (line) => {
    if (!/^\s*\|.*\|\s*$/u.test(line)) return line;
    const boundaries = [];
    let codeFence = "";
    for (let index = 0; index < line.length; index++) {
      if (line[index] === "\\") {
        index++;
        continue;
      }
      if (line[index] === "`") {
        const run = /^`+/u.exec(line.slice(index))[0];
        if (!codeFence) codeFence = run;
        else if (codeFence === run) codeFence = "";
        index += run.length - 1;
      } else if (line[index] === "|" && !codeFence) boundaries.push(index);
    }
    if (boundaries.length < 2) return line;
    const cells = boundaries.slice(1).map((end, index) => line.slice(boundaries[index] + 1, end));
    const separator = cells.every((cell) => /^\s*:?-{3,}:?\s*$/u.test(cell));
    const compact = cells.map((cell) =>
      separator ? cell.replace(/^(\s*:?)-+(:?\s*)$/u, "$1---$2").trim() : cell.trim(),
    );
    return (
      line.slice(0, boundaries[0] + 1) +
      compact.map((cell) => ` ${cell} |`).join("") +
      line.slice(boundaries.at(-1) + 1)
    );
  });
}

/** Overview and child locations for an oversized section, without pretending it was fully read. */
export function sectionPreview(section) {
  const lines = section.text.split("\n");
  const headings = [];
  mapUnfencedLines(section.text, (line) => {
    if (/^#{1,6}\s/u.test(line)) headings.push(line);
    return line;
  });
  const children = new Set(headings.slice(1));
  const firstChild = lines.findIndex((line) => children.has(line));
  const intro = lines
    .slice(1, firstChild < 0 ? lines.length : firstChild)
    .join("\n")
    .trim()
    .split(/\n\s*\n/u)[0];
  const overview = intro && Buffer.byteLength(intro) <= 800 ? `Overview: ${compactMarkdownTables(intro)}` : "";
  let fence = null;
  const pointers = lines.flatMap((line, index) => {
    fence = trackFenceLine(line, fence);
    if (fence || FENCE_MARKER_RE.test(line) || !children.has(line)) return [];
    return [`  ${section.path}:${section.start + index}: ${line.replace(/^#+\s/u, "")}`];
  });
  return [overview, ...pointers].filter(Boolean);
}
