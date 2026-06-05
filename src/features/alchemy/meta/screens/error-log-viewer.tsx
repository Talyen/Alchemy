// Dev-mode error log viewer — displays persisted errors with source, stack, and context.
// Only rendered in DEV mode. Provides copy-to-clipboard for bug reports.
import { useState } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { useErrorLogStore } from "@/features/alchemy/stores/error-log-store";
import { PageLayout, ScreenHeader } from "../../shared/ui/shared-ui";

export function ErrorLogViewer({ onClose }: { onClose: () => void }) {
  const errors = useErrorLogStore((s) => s.errors);
  const clearErrors = useErrorLogStore((s) => s.clearErrors);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  function handleCopyAll() {
    const text = errors
      .map(
        (e) =>
          `[${e.source}] ${e.message}\n  at ${new Date(e.timestamp).toISOString()}\n  stack: ${e.stack ?? "(none)"}\n  context: ${JSON.stringify(e.context)}\n`,
      )
      .join("\n---\n");
    navigator.clipboard.writeText(text).catch(() => {});
  }

  return (
    <PageLayout>
      <div className="alchemy-shell flex min-h-[48.15cqh] w-full max-w-4xl flex-col rounded-shell-screen p-7">
        <div className="relative flex w-full items-center justify-center">
          <ScreenHeader title="Error Log" />
          <div className="absolute right-0 top-1/2 -translate-y-1/2">
            <Button variant="outline" size="sm" onClick={onClose}>
              Close
            </Button>
          </div>
        </div>

        <div className="mt-4 flex gap-2">
          <Button size="sm" variant="outline" onClick={handleCopyAll} disabled={errors.length === 0}>
            Copy All
          </Button>
          <Button size="sm" variant="destructive" onClick={clearErrors} disabled={errors.length === 0}>
            Clear
          </Button>
          <span className="ml-auto self-center text-sm text-muted-foreground">
            {errors.length} error{errors.length !== 1 ? "s" : ""}
          </span>
        </div>

        <div className="mt-4 flex max-h-[60vh] flex-col gap-2 overflow-y-auto">
          {errors.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">No errors logged.</p>
          ) : (
            [...errors].reverse().map((e) => (
              <div
                key={e.id}
                className="surface-muted cursor-pointer rounded-shell-card border border-border/70 p-4 text-left"
                onClick={() => setExpandedId(expandedId === e.id ? null : e.id)}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
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
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">{new Date(e.timestamp).toLocaleString()}</p>
                  </div>
                </div>

                {expandedId === e.id && (
                  <div className="mt-3 space-y-2 border-t border-border/40 pt-3">
                    {e.stack ? (
                      <div>
                        <p className="text-xs font-semibold text-muted-foreground">Stack:</p>
                        <pre className="mt-1 whitespace-pre-wrap break-all rounded-lg bg-black/30 p-2 text-xs text-foreground/80">
                          {e.stack}
                        </pre>
                      </div>
                    ) : null}
                    {e.componentStack ? (
                      <div>
                        <p className="text-xs font-semibold text-muted-foreground">Component Stack:</p>
                        <pre className="mt-1 whitespace-pre-wrap break-all rounded-lg bg-black/30 p-2 text-xs text-foreground/80">
                          {e.componentStack}
                        </pre>
                      </div>
                    ) : null}
                    {e.context ? (
                      <div>
                        <p className="text-xs font-semibold text-muted-foreground">Context:</p>
                        <pre className="mt-1 whitespace-pre-wrap break-all rounded-lg bg-black/30 p-2 text-xs text-foreground/80">
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
      </div>
    </PageLayout>
  );
}
