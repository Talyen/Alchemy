// Generated selectors must not retain an unbounded number of compiled patterns.
const MAX_CACHED_PATTERNS = 512;
const CACHE = new Map();

export function globToRegExp(glob) {
  const cached = CACHE.get(glob);
  if (cached) return cached;
  let source = "^";
  for (let index = 0; index < glob.length; index += 1) {
    if (index === 0 && glob.startsWith("**/")) {
      source += "(?:.*/)?";
      index += 2;
      continue;
    }
    if (glob.startsWith("/**/", index)) {
      source += "/(?:.*/)?";
      index += 3;
      continue;
    }
    if (index === glob.length - 3 && glob.startsWith("/**", index)) {
      source += "(?:/.*)?";
      index += 2;
      continue;
    }
    const char = glob[index];
    if (char === "*" && glob[index + 1] === "*") {
      source += ".*";
      index += 1;
    } else if (char === "*") {
      source += "[^/]*";
    } else if (char === "?") {
      source += "[^/]";
    } else {
      source += char.replace(/[.+^${}()|[\]\\]/gu, "\\$&");
    }
  }
  const regex = new RegExp(`${source}$`, "su");
  if (CACHE.size >= MAX_CACHED_PATTERNS) CACHE.delete(CACHE.keys().next().value);
  CACHE.set(glob, regex);
  return regex;
}
