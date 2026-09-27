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
    const char = glob[index];
    if (char === "*" && glob[index + 1] === "*") {
      source += ".*";
      index += 1;
    } else if (char === "*") source += "[^/]*";
    else if (char === "?") source += "[^/]";
    else source += char.replace(/[.+^${}()|[\]\\]/gu, "\\$&");
  }
  const regex = new RegExp(`${source}$`, "u");
  CACHE.set(glob, regex);
  return regex;
}
