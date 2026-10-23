/** Shared Markdown link/heading/fence/section helpers for docs tooling.
 *
 * Single owner for fence tracking, heading slugs, and document section reads
 * so link checks and discovery section reads cannot drift
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
  if (marker[0] === fence[0] && marker.length >= fence.length && /^ {0,3}(?:`{3,}|~{3,})[ \t]*$/u.test(line))
    return null;
  return fence;
}

function* unfencedLines(lines) {
  let fence = null;
  for (const [index, line] of lines.entries()) {
    fence = trackFenceLine(line.replace(/\r$/u, ""), fence);
    if (!FENCE_MARKER_RE.test(line) && !fence) yield { line, index };
  }
}

/** Preserve offsets while excluding examples from the maintained-link inventory. */
function markdownProse(source) {
  const lines = source.split("\n");
  const visible = new Set([...unfencedLines(lines)].map(({ index }) => index));
  return lines
    .map((line, index) => (visible.has(index) ? line : " ".repeat(line.length)))
    .join("\n")
    .replace(/(?<!`)(`+)(?!`)[\s\S]*?(?<!`)\1(?!`)/gu, (code) => code.replace(/[^\r\n]/g, " "));
}

const normalizeReference = (label) => label.trim().replace(/\s+/gu, " ").toLowerCase();
const unescapeDestination = (target) => target.replace(/\\([\\()[\]<>])/gu, "$1");

/** Read a Markdown destination, retaining spaces in angle brackets and balanced parentheses. */
function linkDestination(source, start) {
  const rest = source.slice(start);
  const angle = /^<([^>\n]*)>/u.exec(rest);
  if (angle) return { target: unescapeDestination(angle[1]), end: start + angle[0].length };
  let depth = 0;
  let end = start;
  for (; end < source.length; end += 1) {
    const char = source[end];
    if (char === "\\" && end + 1 < source.length) {
      end += 1;
      continue;
    }
    if (/\s/u.test(char)) break;
    if (char === "(") depth += 1;
    if (char === ")") {
      if (depth === 0) break;
      depth -= 1;
    }
  }
  if (depth !== 0 || end === start) return null;
  return { target: unescapeDestination(source.slice(start, end)), end };
}

export function extractMarkdownLinkTargets(source) {
  const references = new Map();
  // Definitions can follow their uses. Blank them after collecting so an unused
  // definition does not create an inbound link or a path contract by itself.
  const prose = markdownProse(source).replace(/^ {0,3}\[([^\]\n]+)\]:[ \t]*(.*)$/gmu, (line, label, value) => {
    const destination = linkDestination(value, 0);
    const key = normalizeReference(label);
    if (destination && !references.has(key)) references.set(key, destination.target);
    return " ".repeat(line.length);
  });
  const targets = [];
  const links = /(?<!\\)\[([^\]\n]*)\](?:\[([^\]\n]*)\])?/gu;
  let match;
  while ((match = links.exec(prose))) {
    let target;
    if (match[2] === undefined && prose[match.index + match[0].length] === "(") {
      const start = match.index + match[0].length + 1;
      const whitespace = /^\s*/u.exec(prose.slice(start))[0].length;
      const destination = linkDestination(prose, start + whitespace);
      if (!destination) continue;
      const suffix = prose.slice(destination.end);
      const closing = /^\s*(?:(?:"[^"\n]*"|'[^'\n]*'|\([^()\n]*\))\s*)?\)/u.exec(suffix);
      if (!closing) continue;
      links.lastIndex = destination.end + closing[0].length;
      target = destination.target;
    } else {
      target = references.get(normalizeReference(match[2] || match[1]));
    }
    if (target) targets.push({ target, index: match.index });
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
  for (const { line } of unfencedLines(source.split("\n"))) {
    const match = /^(#{1,6})\s+(.+?)\s*#*\s*$/u.exec(line);
    if (!match?.[2]) continue;
    const base = githubHeadingSlug(headingPlainText(match[2]));
    if (!base) continue;
    let count = seen.get(base) ?? 0;
    let slug = count === 0 ? base : `${base}-${count}`;
    while (slugs.has(slug)) slug = `${base}-${++count}`;
    seen.set(base, count + 1);
    slugs.add(slug);
  }
  return slugs;
}

/** Read a heading-delimited section of a repo document, ignoring headings inside fenced blocks. */
export function readDocumentSection(rootDir, relativePath, heading = null) {
  const source = fs.readFileSync(path.join(rootDir, relativePath), "utf8");
  const lines = source.split(/\r?\n/u);
  const headings = Array.from(unfencedLines(lines)).flatMap(({ line, index }) => {
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
