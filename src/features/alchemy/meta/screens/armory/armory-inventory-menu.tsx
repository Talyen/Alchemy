import { useEffect, useId, useLayoutEffect, useRef, type ReactNode, type RefObject } from "react";
import { autoUpdate, computePosition, offset, shift, size } from "@floating-ui/dom";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ESCAPE_PRIORITY } from "@/app/escape-stack";
import { focusControl } from "@/features/alchemy/shared/ui/focus-navigation";
import { useModalEscapeDismiss } from "@/features/alchemy/shared/ui/use-modal-escape-dismiss";

export function ArmoryInventoryMenu({
  label,
  open,
  triggerRef,
  onDismiss,
  trigger: renderTrigger,
  children,
}: {
  label: string;
  open: boolean;
  triggerRef: RefObject<HTMLButtonElement | null>;
  onDismiss: (restoreFocus: boolean) => void;
  trigger: (panelId: string) => ReactNode;
  children: ReactNode;
}) {
  const panelId = useId();
  const regionRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  useModalEscapeDismiss({
    active: open,
    id: "armory-inventory-menu",
    priority: ESCAPE_PRIORITY.DIALOG,
    onEscape: () => onDismiss(true),
  });

  useEffect(() => {
    if (!open) return;
    const dismissOutside = (event: PointerEvent) => {
      if (event.target instanceof Node && !regionRef.current?.contains(event.target)) onDismiss(false);
    };
    document.addEventListener("pointerdown", dismissOutside);
    return () => document.removeEventListener("pointerdown", dismissOutside);
  }, [open, onDismiss]);

  useLayoutEffect(() => {
    const trigger = triggerRef.current;
    const panel = panelRef.current;
    const inventory = trigger?.closest<HTMLElement>('[data-testid="armory-right-panel"]');
    if (!open || !trigger || !panel || !inventory) return;
    let disposed = false;
    let focused = false;
    const update = () => {
      const scale = inventory.getBoundingClientRect().width / inventory.offsetWidth || 1;
      void computePosition(trigger, panel, {
        placement: "bottom-end",
        middleware: [
          offset(8),
          shift({ boundary: inventory, padding: 8 * scale }),
          size({
            boundary: inventory,
            padding: 8 * scale,
            apply({ availableWidth, availableHeight }) {
              if (disposed) return;
              // Floating UI already normalizes available dimensions to the scaled offset parent.
              panel.style.maxWidth = `${Math.max(0, availableWidth)}px`;
              panel.style.maxHeight = `${Math.max(0, availableHeight)}px`;
            },
          }),
        ],
      }).then(({ x, y }) => {
        if (disposed) return;
        Object.assign(panel.style, { left: `${x}px`, top: `${y}px`, visibility: "visible" });
        if (!focused) {
          focused = true;
          focusControl(panel.querySelector<HTMLElement>("button, input"));
        }
      });
    };
    const cleanup = autoUpdate(trigger, panel, update, {
      elementResize: typeof ResizeObserver !== "undefined",
      layoutShift: typeof IntersectionObserver !== "undefined",
    });
    return () => {
      disposed = true;
      cleanup();
    };
  }, [open, triggerRef]);

  return (
    <div
      ref={regionRef}
      className="relative shrink-0"
      onBlur={(event) => {
        if (event.relatedTarget instanceof Node && !event.currentTarget.contains(event.relatedTarget)) onDismiss(false);
      }}
    >
      {renderTrigger(panelId)}
      {open ? (
        <div ref={panelRef} id={panelId} role="dialog" aria-label={label} className="armory-inventory-menu">
          <div className="mb-3 flex items-center justify-between gap-3 border-b border-border/50 pb-2">
            <h3 className="text-base font-semibold text-primary">{label}</h3>
            <Button
              variant="ghost"
              size="icon"
              aria-label={`Close ${label.toLowerCase()}`}
              className="h-8 w-8 shrink-0"
              onClick={() => onDismiss(true)}
            >
              <X aria-hidden="true" className="h-4 w-4" />
            </Button>
          </div>
          {children}
        </div>
      ) : null}
    </div>
  );
}
