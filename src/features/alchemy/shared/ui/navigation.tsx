import { ChevronLeft, ChevronRight, Menu } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

export function PaginationControls({
  page,
  totalPages,
  onPageChange,
  size = "sm",
  reserveSpace = false,
  className,
}: {
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  size?: "sm" | "default";
  reserveSpace?: boolean;
  className?: string;
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
          <Button
            aria-label="Previous page"
            className={buttonClass}
            variant="outline"
            size="icon"
            disabled={page === 0}
            onClick={() => onPageChange(page - 1)}
          >
            <ChevronLeft className="h-5 w-5" />
          </Button>
          <Button
            aria-label="Next page"
            className={buttonClass}
            variant="outline"
            size="icon"
            disabled={page >= totalPages - 1}
            onClick={() => onPageChange(page + 1)}
          >
            <ChevronRight className="h-5 w-5" />
          </Button>
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
}: {
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  children: ReactNode;
  className?: string;
}) {
  const showControls = totalPages > 1;
  const buttonClass = "h-11 w-11";

  return (
    <div className={cn("flex w-full items-center justify-center gap-3", className)}>
      <Button
        aria-label="Previous page"
        aria-hidden={!showControls}
        tabIndex={showControls ? undefined : -1}
        className={cn(buttonClass, !showControls && "pointer-events-none invisible")}
        variant="outline"
        size="icon"
        disabled={!showControls || page === 0}
        onClick={() => onPageChange(page - 1)}
      >
        <ChevronLeft className="h-5 w-5" />
      </Button>
      <div className="min-w-0 flex-1">{children}</div>
      <Button
        aria-label="Next page"
        aria-hidden={!showControls}
        tabIndex={showControls ? undefined : -1}
        className={cn(buttonClass, !showControls && "pointer-events-none invisible")}
        variant="outline"
        size="icon"
        disabled={!showControls || page >= totalPages - 1}
        onClick={() => onPageChange(page + 1)}
      >
        <ChevronRight className="h-5 w-5" />
      </Button>
    </div>
  );
}

export function HamburgerTrigger({
  onClick,
  label = "Open menu",
}: {
  onClick: (rect: DOMRect) => void;
  label?: string;
}) {
  return (
    <Button
      variant="outline"
      size="icon"
      className="h-10 w-10 text-muted-foreground"
      onClick={(e) => onClick(e.currentTarget.getBoundingClientRect())}
      aria-label={label}
    >
      <Menu className="h-5 w-5" />
    </Button>
  );
}
