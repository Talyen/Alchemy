import { useGameTranslation } from "@/components/use-game-translation";

import { useMemo } from "react";
import { createPortal } from "react-dom";
import { useFadePresence, useHeldWhile, fadePhaseClass } from "../../../shared/ui/use-fade";
import { cn } from "@/lib/utils";

export type ArmoryFeedbackTone = "success" | "warning" | "error";

export function ArmoryFeedback({
  notice,
  onDismiss,
  tone = "success",
}: {
  notice: string;
  onDismiss: () => void;
  tone?: ArmoryFeedbackTone;
}) {
  const i18n = useGameTranslation();
  const open = Boolean(notice);
  const { mounted, phase } = useFadePresence(open);
  const content = useMemo(() => ({ notice, tone }), [notice, tone]);
  const held = useHeldWhile(open, content);
  if (!mounted) return null;
  return createPortal(
    <div
      className={cn(
        "alchemy-shell fixed right-5 bottom-5 z-[110] w-[26rem] max-w-[calc(100vw-2.5rem)] rounded-xl border p-4 shadow-2xl",
        held.tone === "error"
          ? "border-red-400/50"
          : held.tone === "warning"
            ? "border-warning/50"
            : "border-emerald-300/30",
        fadePhaseClass(phase),
      )}
      inert={!open}
    >
      {held.notice ? (
        <>
          <p
            role={held.tone === "success" ? "status" : "alert"}
            className={cn(
              "text-sm",
              held.tone === "error" ? "text-red-100" : held.tone === "warning" ? "text-warning" : "text-gold-pale",
            )}
          >
            {i18n.displayText(held.notice)}
          </p>
          <button
            type="button"
            className="mt-2 rounded px-2 py-1 text-sm underline underline-offset-4"
            onClick={onDismiss}
          >
            {i18n.text("ui.armory-feedback.1", "Dismiss message")}
          </button>
        </>
      ) : null}
    </div>,
    document.body,
  );
}
