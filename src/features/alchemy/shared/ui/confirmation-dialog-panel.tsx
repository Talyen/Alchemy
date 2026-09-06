import { useEffect, useRef, type ReactNode, type KeyboardEvent, type RefObject } from "react";

const FOCUSABLE =
  'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex="0"]';

export function ConfirmationDialogPanel({
  children,
  labelledBy,
  describedBy,
  returnFocusRef,
}: {
  children: ReactNode;
  labelledBy: string;
  describedBy: string | undefined;
  returnFocusRef?: RefObject<HTMLElement | null> | undefined;
}) {
  const panelRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const panel = panelRef.current;
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const returnTarget = returnFocusRef?.current ?? previous;
    const cancel = panel?.querySelector<HTMLElement>("[data-dialog-cancel]");
    cancel?.focus();
    const keepFocus = (event: FocusEvent) => {
      if (event.target instanceof Node && !panel?.contains(event.target)) (cancel ?? panel)?.focus();
    };
    document.addEventListener("focusin", keepFocus);
    return () => {
      document.removeEventListener("focusin", keepFocus);
      if (returnTarget?.isConnected) returnTarget.focus();
    };
  }, [returnFocusRef]);

  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key !== "Tab") return;
    const elements = [...event.currentTarget.querySelectorAll<HTMLElement>(FOCUSABLE)];
    const first = elements[0];
    const last = elements.at(-1);
    if (event.shiftKey && (document.activeElement === first || document.activeElement === event.currentTarget)) {
      event.preventDefault();
      last?.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first?.focus();
    }
  }

  return (
    // eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions -- Modal contains keyboard focus and stops clicks from reaching its backdrop
    <div
      ref={panelRef}
      role="dialog"
      aria-modal="true"
      aria-labelledby={labelledBy}
      aria-describedby={describedBy}
      tabIndex={-1}
      data-testid="confirmation-dialog"
      className="motion-panel alchemy-shell max-h-[90dvh] w-full max-w-[calc(33.6015*var(--content-rem,1rem))] overflow-y-auto rounded-shell-dialog border border-border/80 px-7 py-7 text-center"
      onKeyDown={handleKeyDown}
      onClick={(event) => event.stopPropagation()}
    >
      {children}
    </div>
  );
}
