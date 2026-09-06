import fs from "node:fs";
import path from "node:path";

export function readDocumentSection(rootDir, relativePath, heading = null) {
  const source = fs.readFileSync(path.join(rootDir, relativePath), "utf8");
  const lines = source.split(/\r?\n/u);
  let fence = null;
  const headings = lines.flatMap((line, index) => {
    const marker = /^ {0,3}(`{3,}|~{3,})/u.exec(line)?.[1];
    if (marker) {
      if (!fence) fence = marker;
      else if (marker[0] === fence[0] && marker.length >= fence.length) fence = null;
      return [];
    }
    if (fence) return [];
    const match = /^(#{1,6})\s+(.+?)\s*$/u.exec(line);
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
