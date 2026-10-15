import { text as gameText, displayText } from "@/lib/localization/runtime";
import { GameMessage } from "@/components/localization";
import { useGameTranslation } from "@/components/use-game-translation";
import { useMemo, useState } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { useErrorLogStore, type LoggedError } from "@/features/alchemy/shared/stores/error-log-store";
import { ScreenHeaderRow, ScreenShell } from "../../../shared/ui/layout-components";

function displayContext(context: Record<string, unknown> | undefined, indent?: number): string | undefined {
  try {
    return JSON.stringify(context, null, indent);
  } catch {
    return "Context could not be displayed.";
  }
}

function formatLoggedError(entry: LoggedError): string {
  const lines = [
    `[${entry.source}] ${entry.message}`,
    `  at ${new Date(entry.timestamp).toISOString()}`,
    `  stack: ${entry.stack ?? "(none)"}`,
    `  context: ${displayContext(entry.context)}`,
  ];
  if (entry.componentStack) lines.push(`  component stack: ${entry.componentStack}`);
  return `${lines.join("\n")}\n`;
}

export function ErrorLogViewer({ onClose }: { onClose: () => void }) {
  useGameTranslation();
  const errors = useErrorLogStore((s) => s.errors);
  const clearErrors = useErrorLogStore((s) => s.clearErrors);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [copyFeedback, setCopyFeedback] = useState<{
    status: "copied" | "failed";
    entries: typeof errors;
  } | null>(null);

  const reversedErrors = useMemo(() => [...errors].reverse(), [errors]);
  // The capped log can replace entries without changing its length.
  const visibleCopyFeedback = copyFeedback?.entries === errors ? copyFeedback : null;

  async function handleCopyAll() {
    setCopyFeedback(null);
    try {
      const text = errors.map(formatLoggedError).join("\n---\n");
      if (!navigator.clipboard?.writeText) {
        setCopyFeedback({ status: "failed", entries: errors });
        return;
      }
      await navigator.clipboard.writeText(text);
      setCopyFeedback({ status: "copied", entries: errors });
    } catch {
      setCopyFeedback({ status: "failed", entries: errors });
    }
  }

  return (
    <ScreenShell maxWidthClass="max-w-4xl">
      <ScreenHeaderRow
        title={gameText("ui.error-log-viewer.1", "Error Log")}
        trailing={
          <Button variant="outline" size="sm" onClick={onClose}>
            {gameText("ui.error-log-viewer.2", "Close")}
          </Button>
        }
      />

      <div className="mt-4 flex gap-2">
        <Button size="sm" variant="outline" onClick={() => void handleCopyAll()} disabled={errors.length === 0}>
          {gameText("ui.error-log-viewer.3", "Copy All")}
        </Button>
        <Button size="sm" variant="destructive" onClick={clearErrors} disabled={errors.length === 0}>
          {gameText("ui.error-log-viewer.4", "Clear")}
        </Button>
        <span className="ml-auto self-center text-sm text-muted-foreground">
          <GameMessage
            id="ui.error-log-viewer.s1"
            defaultValue="<part0/><part1/> error<part2/>"
            parts={{
              part0: displayText(
                visibleCopyFeedback?.status === "copied"
                  ? gameText("ui.error-log-viewer.d1", "Copied · ")
                  : visibleCopyFeedback?.status === "failed"
                    ? gameText("ui.error-log-viewer.d2", "Copy failed · ")
                    : null,
              ),
              part1: displayText(errors.length),
              part2: displayText(errors.length !== 1 ? "s" : ""),
            }}
          />
        </span>
      </div>

      <div className="mt-4 flex max-h-[60cqh] flex-col gap-2 overflow-y-auto">
        {errors.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            {gameText("ui.error-log-viewer.6", "No errors logged")}
          </p>
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
                      {displayText(e.source)}
                    </span>
                    <span className="truncate text-sm font-semibold text-foreground">{displayText(e.message)}</span>
                  </span>
                  <span className="mt-1 block text-xs text-muted-foreground">
                    {displayText(new Date(e.timestamp).toLocaleString())}
                  </span>
                </span>
              </button>

              {expandedId === e.id && (
                <div className="mt-3 space-y-2 border-t border-border/40 pt-3">
                  <p className="text-sm break-words whitespace-pre-wrap text-foreground">{displayText(e.message)}</p>
                  {[
                    { label: "Stack", text: e.stack },
                    { label: "Component Stack", text: e.componentStack },
                    { label: "Context", text: e.context ? displayContext(e.context, 2) : undefined },
                  ].map(({ label, text }) =>
                    text ? (
                      <div key={label}>
                        <p className="text-xs font-semibold text-muted-foreground">
                          <GameMessage
                            id="ui.error-log-viewer.s2"
                            defaultValue="<part0/>:"
                            parts={{ part0: displayText(label) }}
                          />
                        </p>
                        <pre className="mt-1 rounded-lg bg-black/30 p-2 text-xs break-all whitespace-pre-wrap text-foreground/80">
                          {displayText(text)}
                        </pre>
                      </div>
                    ) : null,
                  )}
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </ScreenShell>
  );
}
