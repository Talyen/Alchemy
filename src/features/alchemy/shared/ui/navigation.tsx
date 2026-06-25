// Navigation controls for pagination and menu triggers.
import { ChevronLeft, ChevronRight, Menu } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

const NAVIGATION_CONFIG = {
  paginationMinHeightClass: "min-h-[4.07cqh]",
} as const;

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
  const buttonClass = size === "sm" ? "h-9 w-9" : "h-11 w-11";
  const widthClass = size === "sm" ? "max-w-28" : "max-w-36";

  if (totalPages <= 1) {
    return reserveSpace ? (
      <div
        className={cn("mt-4 w-full", NAVIGATION_CONFIG.paginationMinHeightClass, widthClass, className)}
        aria-hidden="true"
      />
    ) : null;
  }

  return (
    <div
      className={cn(
        "mt-4 flex w-full items-center justify-center gap-4",
        NAVIGATION_CONFIG.paginationMinHeightClass,
        widthClass,
        className,
      )}
    >
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
    </div>
  );
}

/** Standardized hamburger trigger button for the GameMenu overlay. */
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
