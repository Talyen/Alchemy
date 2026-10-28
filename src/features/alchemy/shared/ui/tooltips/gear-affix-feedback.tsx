import { Children, cloneElement, isValidElement, useEffect, useState, type CSSProperties, type ReactNode } from "react";

import { useReducedMotionPreference } from "@/components/ui/use-reduced-motion-preference";
import type { GearAffixTooltipEntry } from "@/lib/gear";

const CHANGE_MS = 360;
interface AffixRow {
  entry: GearAffixTooltipEntry;
  change?: "added" | "removed";
  revision: number;
}

/** A mounted inspection owns its feedback; reopening it starts with the actual current item. */
export function useGearAffixFeedback(entries: GearAffixTooltipEntry[]) {
  const reducedMotion = useReducedMotionPreference();
  const signature = JSON.stringify(entries);
  const [snapshot, setSnapshot] = useState(() => ({
    signature,
    entries,
    revision: 0,
    rows: entries.map((entry): AffixRow => ({ entry, revision: 0 })),
  }));

  if (signature !== snapshot.signature) {
    const revision = snapshot.revision + 1;
    const current = new Map(entries.map((entry) => [entry.affixId, entry]));
    const previous = new Set(snapshot.entries.map((entry) => entry.affixId));
    const rows: AffixRow[] = reducedMotion
      ? entries.map((entry) => ({ entry, revision }))
      : [
          ...snapshot.entries.map(
            (entry): AffixRow => ({
              entry: current.get(entry.affixId) ?? entry,
              ...(current.has(entry.affixId) ? {} : { change: "removed" }),
              revision,
            }),
          ),
          ...entries
            .filter((entry) => !previous.has(entry.affixId))
            .map((entry): AffixRow => ({ entry, change: "added", revision })),
        ];
    // Adjust during render so a removed row never flashes out before its exit begins.
    setSnapshot({ signature, entries, revision, rows });
  }

  useEffect(() => {
    if (!snapshot.rows.some((row) => row.change)) return;
    const revision = snapshot.revision;
    const timer = window.setTimeout(
      () =>
        setSnapshot((current) =>
          current.revision === revision
            ? {
                ...current,
                rows: current.entries.map((entry) => ({ entry, revision })),
              }
            : current,
        ),
      reducedMotion ? 0 : CHANGE_MS,
    );
    return () => window.clearTimeout(timer);
  }, [snapshot.revision, snapshot.rows, reducedMotion]);

  return reducedMotion ? entries.map((entry): AffixRow => ({ entry, revision: snapshot.revision })) : snapshot.rows;
}

/** Keep localized keyword spans and whitespace intact; opacity never changes glyph geometry. */
export function revealAffixWords(content: ReactNode): ReactNode {
  let word = 0;
  function visit(node: ReactNode): ReactNode {
    if (typeof node === "string" || typeof node === "number") {
      return String(node)
        .split(/(\s+)/u)
        .map((part, index) =>
          !part || /^\s+$/u.test(part) ? (
            part
          ) : (
            <span
              key={index}
              className="gear-affix-word"
              style={{ "--affix-word-delay": `${Math.min(word++ * 28, 140)}ms` } as CSSProperties}
            >
              {part}
            </span>
          ),
        );
    }
    if (isValidElement<{ children?: ReactNode }>(node))
      return cloneElement(node, {}, Children.map(node.props.children, visit));
    return node;
  }
  return Children.map(content, visit);
}
