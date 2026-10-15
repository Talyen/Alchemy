import { Fragment, type ReactNode } from "react";
import { parseRichText, type RichTextNode } from "@/lib/localization/rich-text";

import { useGameTranslation } from "./use-game-translation";

/** Whole UI sentences can reorder embedded icons, values and controls. */
export function GameMessage({
  id,
  defaultValue,
  parts,
}: {
  id: string;
  defaultValue: string;
  parts: Record<string, ReactNode>;
}) {
  const i18n = useGameTranslation();
  const nodes = parseRichText(i18n.text(id, defaultValue), new Set(Object.keys(parts)));
  function render(nodes: RichTextNode[]): ReactNode[] {
    return nodes.map((node, index) => (
      <Fragment key={node.name ? `slot:${node.name}` : `text:${index}`}>
        {node.name ? parts[node.name] : node.text}
      </Fragment>
    ));
  }
  return <>{render(nodes)}</>;
}
