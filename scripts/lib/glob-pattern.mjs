export function globToRegExp(glob) {
  let source = "^";
  for (let index = 0; index < glob.length; index += 1) {
    const char = glob[index];
    if (char === "*" && glob[index + 1] === "*") {
      source += ".*";
      index += 1;
    } else if (char === "*") source += "[^/]*";
    else if (char === "?") source += "[^/]";
    else source += char.replace(/[.+^${}()|[\]\\]/gu, "\\$&");
  }
  return new RegExp(`${source}$`, "u");
}

const patternCache = new Map();

export function matchesPattern(filePath, pattern) {
  let expression = patternCache.get(pattern);
  if (!expression) {
    expression = globToRegExp(pattern);
    patternCache.set(pattern, expression);
  }
  return expression.test(filePath);
}

export function headingExists(source, heading) {
  const escaped = heading.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
  return new RegExp(`^#{1,6}\\s+${escaped}\\s*#*\\s*$`, "mu").test(source);
}
