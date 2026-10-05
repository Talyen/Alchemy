import { ChevronLeft, ChevronRight, Menu } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { ChromeIconButton } from "./chrome-icon-button";

interface PaginationProps {
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  className?: string;
}

function PageArrow({
  page,
  totalPages,
  onPageChange,
  direction,
  className,
  hidden = false,
}: PaginationProps & { direction: -1 | 1; hidden?: boolean }) {
  const previous = direction === -1;
  const Icon = previous ? ChevronLeft : ChevronRight;
  return (
    <Button
      aria-label={previous ? "Previous page" : "Next page"}
      aria-hidden={hidden || undefined}
      tabIndex={hidden ? -1 : undefined}
      className={cn(className, hidden && "pointer-events-none invisible")}
      variant="outline"
      size="icon"
      disabled={hidden || (previous ? page === 0 : page >= totalPages - 1)}
      onClick={() => onPageChange(page + direction)}
    >
      <Icon className="h-5 w-5" />
    </Button>
  );
}

export function PaginationControls({
  page,
  totalPages,
  onPageChange,
  size = "sm",
  reserveSpace = false,
  className,
}: PaginationProps & {
  size?: "sm" | "default";
  reserveSpace?: boolean;
}) {
  const showControls = totalPages > 1;
  const buttonClass = size === "sm" ? "h-11 w-11" : "h-14 w-14";
  const widthClass = size === "sm" ? "max-w-28" : "max-w-36";
  const minHeightClass = size === "sm" ? "min-h-11" : "min-h-14";

  if (!showControls && !reserveSpace) return null;

  return (
    <div className={cn("mt-4 flex w-full items-center justify-center gap-4", minHeightClass, widthClass, className)}>
      {showControls ? (
        <>
          <PageArrow
            page={page}
            totalPages={totalPages}
            onPageChange={onPageChange}
            direction={-1}
            className={buttonClass}
          />
          <PageArrow
            page={page}
            totalPages={totalPages}
            onPageChange={onPageChange}
            direction={1}
            className={buttonClass}
          />
        </>
      ) : null}
    </div>
  );
}

export function FlankingPagination({
  page,
  totalPages,
  onPageChange,
  children,
  className,
}: PaginationProps & { children: ReactNode }) {
  const showControls = totalPages > 1;
  const arrowProps = { page, totalPages, onPageChange, hidden: !showControls, className: "h-11 w-11" };

  return (
    <div className={cn("flex w-full items-center justify-center gap-3", className)}>
      <PageArrow {...arrowProps} direction={-1} />
      <div className="min-w-0 flex-1">{children}</div>
      <PageArrow {...arrowProps} direction={1} />
    </div>
  );
}

export function HamburgerTrigger({
  onClick,
  label = "Open menu",
  className,
  active = false,
}: {
  onClick: (rect: DOMRect) => void;
  label?: string;
  className?: string;
  active?: boolean | undefined;
}) {
  return (
    <ChromeIconButton
      className={cn(className)}
      active={active}
      onClick={(e) => onClick(e.currentTarget.getBoundingClientRect())}
      aria-label={label}
    >
      <Menu className="h-6 w-6" />
    </ChromeIconButton>
  );
}
