import { useMemo } from "react";
import { createPortal } from "react-dom";
import { type GearInstance } from "@/lib/gear";
import { CraftingResultPreview, type CraftingResult } from "./crafting-result";
import { useFadePresence, useHeldWhile, fadePhaseClass } from "../../../shared/ui/use-fade";
import { cn } from "@/lib/utils";

export function ArmoryFeedback({
  notice,
  result,
  after,
  onDismiss,
  error = false,
}: {
  notice: string;
  result: CraftingResult | null;
  after: GearInstance | undefined;
  onDismiss: () => void;
  error?: boolean;
}) {
  const open = Boolean(notice || (result && after));
  const { mounted, phase } = useFadePresence(open);
  const content = useMemo(() => ({ notice, result, after, error }), [notice, result, after, error]);
  const held = useHeldWhile(open, content);
  if (!mounted) return null;
  return createPortal(
    <div
      className={cn(
        "alchemy-shell fixed right-5 bottom-5 z-[110] w-[26rem] max-w-[calc(100vw-2.5rem)] rounded-xl border p-4 shadow-2xl",
        held.error ? "border-red-400/50" : "border-emerald-300/30",
        fadePhaseClass(phase),
      )}
      inert={!open}
    >
      {held.notice ? (
        <>
          <p
            role={held.error ? "alert" : "status"}
            className={cn("text-sm", held.error ? "text-red-100" : "text-amber-100")}
          >
            {held.notice}
          </p>
          <button
            type="button"
            className="mt-2 rounded px-2 py-1 text-sm underline underline-offset-4"
            onClick={onDismiss}
          >
            Dismiss message
          </button>
        </>
      ) : held.result && held.after ? (
        <CraftingResultPreview result={held.result} after={held.after} onDismiss={onDismiss} />
      ) : null}
    </div>,
    document.body,
  );
}
