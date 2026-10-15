/** Leave named parameters and semantic markup intact while expanding text. */
export function pseudolocalize(value: string): string {
  if (!/[a-zA-Z]/.test(value.replace(/{{.*?}}|<[^>]+>/g, ""))) return value;
  const accents: Record<string, string> = {
    a: "á",
    e: "ë",
    i: "ï",
    o: "ô",
    u: "ü",
    A: "Á",
    E: "Ë",
    I: "Ï",
    O: "Ô",
    U: "Ü",
  };
  return `[${value
    .split(/({{.*?}}|<[^>]+>)/g)
    .map((part) =>
      part.startsWith("{{") || part.startsWith("<")
        ? part
        : part.replace(/[aeiouAEIOU]/g, (letter) => `${accents[letter]}${accents[letter]}`),
    )
    .join("")}]`;
}
