import { useMemo, useState } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { useErrorLogStore } from "@/features/alchemy/shared/stores/error-log-store";
import { ScreenHeaderRow, ScreenShell } from "../../shared/ui/layout-components";

export function ErrorLogViewer({ onClose }: { onClose: () => void }) {
  const errors = useErrorLogStore((s) => s.errors);
  const clearErrors = useErrorLogStore((s) => s.clearErrors);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [copyFeedback, setCopyFeedback] = useState<{ status: "copied" | "failed"; errorCount: number } | null>(null);

  const reversedErrors = useMemo(() => [...errors].reverse(), [errors]);
  // Feedback is shown only while it describes the current list; a new error or
  // Clear invalidates it via the errorCount check below without an effect.
  const visibleCopyFeedback = copyFeedback && copyFeedback.errorCount === errors.length ? copyFeedback : null;

  async function handleCopyAll() {
    const errorCount = errors.length;
    setCopyFeedback(null);
    const text = errors
      .map(
        (e) =>
          `[${e.source}] ${e.message}\n  at ${new Date(e.timestamp).toISOString()}\n  stack: ${e.stack ?? "(none)"}\n  context: ${JSON.stringify(e.context)}\n`,
      )
      .join("\n---\n");
    try {
      if (!navigator.clipboard?.writeText) {
        setCopyFeedback({ status: "failed", errorCount });
        return;
      }
      await navigator.clipboard.writeText(text);
      setCopyFeedback({ status: "copied", errorCount });
    } catch {
      setCopyFeedback({ status: "failed", errorCount });
    }
  }

  return (
    <ScreenShell maxWidthClass="max-w-4xl">
      <ScreenHeaderRow
        title="Error Log"
        trailing={
          <Button variant="outline" size="sm" onClick={onClose}>
            Close
          </Button>
        }
      />

      <div className="mt-4 flex gap-2">
        <Button size="sm" variant="outline" onClick={() => void handleCopyAll()} disabled={errors.length === 0}>
          Copy All
        </Button>
        <Button size="sm" variant="destructive" onClick={clearErrors} disabled={errors.length === 0}>
          Clear
        </Button>
        <span className="ml-auto self-center text-sm text-muted-foreground">
          {visibleCopyFeedback?.status === "copied"
            ? "Copied. "
            : visibleCopyFeedback?.status === "failed"
              ? "Copy failed. "
              : null}
          {errors.length} error{errors.length !== 1 ? "s" : ""}
        </span>
      </div>

      <div className="mt-4 flex max-h-[60vh] flex-col gap-2 overflow-y-auto">
        {errors.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">No errors logged.</p>
        ) : (
          reversedErrors.map((e) => (
            <div key={e.id} className="rounded-shell-card border border-border/70 p-4 text-left surface-muted">
              <button
                type="button"
                aria-expanded={expandedId === e.id}
                className="flex w-full cursor-pointer items-start justify-between gap-2 rounded-sm text-left focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-primary"
                onClick={() => setExpandedId(expandedId === e.id ? null : e.id)}
              >
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-2">
                    <span
                      className={cn(
                        "inline-block rounded-full px-2 py-0.5 text-xs font-semibold",
                        e.source === "react"
                          ? "bg-red-900/40 text-red-300"
                          : e.source === "global" || e.source === "promise"
                            ? "bg-orange-900/40 text-orange-300"
                            : "bg-blue-900/40 text-blue-300",
                      )}
                    >
                      {e.source}
                    </span>
                    <span className="truncate text-sm font-semibold text-foreground">{e.message}</span>
                  </span>
                  <span className="mt-1 block text-xs text-muted-foreground">
                    {new Date(e.timestamp).toLocaleString()}
                  </span>
                </span>
              </button>

              {expandedId === e.id && (
                <div className="mt-3 space-y-2 border-t border-border/40 pt-3">
                  {e.stack ? (
                    <div>
                      <p className="text-xs font-semibold text-muted-foreground">Stack:</p>
                      <pre className="mt-1 rounded-lg bg-black/30 p-2 text-xs break-all whitespace-pre-wrap text-foreground/80">
                        {e.stack}
                      </pre>
                    </div>
                  ) : null}
                  {e.componentStack ? (
                    <div>
                      <p className="text-xs font-semibold text-muted-foreground">Component Stack:</p>
                      <pre className="mt-1 rounded-lg bg-black/30 p-2 text-xs break-all whitespace-pre-wrap text-foreground/80">
                        {e.componentStack}
                      </pre>
                    </div>
                  ) : null}
                  {e.context ? (
                    <div>
                      <p className="text-xs font-semibold text-muted-foreground">Context:</p>
                      <pre className="mt-1 rounded-lg bg-black/30 p-2 text-xs break-all whitespace-pre-wrap text-foreground/80">
                        {JSON.stringify(e.context, null, 2)}
                      </pre>
                    </div>
                  ) : null}
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </ScreenShell>
  );
}
