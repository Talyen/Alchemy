export interface RichTextNode {
  name?: string;
  text?: string;
  children?: RichTextNode[];
}

/** Restricted catalog markup: no HTML, attributes or translator-supplied props. */
export function parseRichText(value: string, allowed: ReadonlySet<string>): RichTextNode[] {
  const root: RichTextNode[] = [];
  const stack: Array<{ name: string; children: RichTextNode[] }> = [{ name: "", children: root }];
  for (const part of value.split(/(<[^>]*>)/g)) {
    if (!part) continue;
    if (!part.startsWith("<")) {
      stack.at(-1)!.children.push({ text: part });
      continue;
    }
    const match = /^<(\/)?([a-zA-Z][\w]*)(\/?)>$/.exec(part);
    if (!match || !allowed.has(match[2]!)) throw new Error("Invalid localized semantic tag");
    const name = match[2]!;
    if (match[1]) {
      if (stack.length === 1 || stack.pop()!.name !== name) throw new Error("Unbalanced localized semantic tags");
    } else {
      const children: RichTextNode[] = [];
      stack.at(-1)!.children.push({ name, children });
      if (!match[3]) stack.push({ name, children });
    }
  }
  if (stack.length !== 1) throw new Error("Unclosed localized semantic tag");
  return root;
}
