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
    const current = stack[stack.length - 1];
    if (!current) throw new Error("Unbalanced localized semantic tags");
    if (!part.startsWith("<")) {
      current.children.push({ text: part });
      continue;
    }
    const match = /^<(\/)?([a-zA-Z][\w]*)(\/?)>$/.exec(part);
    const tagName = match?.[2];
    if (!tagName || !allowed.has(tagName)) throw new Error("Invalid localized semantic tag");
    if (match[1]) {
      if (stack.length === 1 || stack.pop()?.name !== tagName) throw new Error("Unbalanced localized semantic tags");
    } else {
      const children: RichTextNode[] = [];
      current.children.push({ name: tagName, children });
      if (!match[3]) stack.push({ name: tagName, children });
    }
  }
  if (stack.length !== 1) throw new Error("Unclosed localized semantic tag");
  return root;
}
