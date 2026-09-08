import { type ReactNode, type RefObject } from "react";
import { useDialogFocus } from "./use-dialog-focus";

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
  const { panelRef, handleKeyDown } = useDialogFocus(returnFocusRef);
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
