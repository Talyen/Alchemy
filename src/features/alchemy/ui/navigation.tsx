// Navigation controls for pagination and the in-game menu overlay.
// Depends on shared Button styling, Lucide icons, and direct viewport anchoring.
// Used by collection-style grids and battle/menu screens.
import { BookOpen, ChevronLeft, ChevronRight, Cog, House, Menu, Swords, TreePine, WandSparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import type { Screen } from "../types";

const NAVIGATION_CONFIG = {
  paginationMinHeightClass: "min-h-[4.07cqh]",
  anchoredMenuOffsetPx: 8,
  anchoredMenuWidthPx: 392,
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

export function GameMenu({
  isOpen,
  onClose,
  onMainMenu,
  onCollection,
  onTalents,
  onHomestead,
  onOptions,
  onEndRun,
  onReturnToBattle,
  anchorRect,
  anchorPlacement = "up-left",
  currentScreen,
}: {
  isOpen: boolean;
  onClose: () => void;
  onMainMenu: () => void;
  onCollection: () => void;
  onTalents: () => void;
  onHomestead: () => void;
  onOptions: () => void;
  onEndRun?: () => void;
  onReturnToBattle?: () => void;
  anchorRect?: DOMRect | null;
  anchorPlacement?: "up-left" | "down-right" | "down-right-of-anchor";
  currentScreen?: Screen;
}) {
  if (!isOpen) return null;

  const panel = (
    <div
      data-testid="game-menu"
      className="motion-panel alchemy-shell w-full max-w-[35.56cqh] rounded-shell-dialog border border-border/80 px-4 py-5"
      onClick={(e) => e.stopPropagation()}
    >
      <div className="grid gap-2">
        {onReturnToBattle ? (
          <Button
            variant="outline"
            className="justify-start border-0 bg-transparent"
            onClick={() => {
              onReturnToBattle();
              onClose();
            }}
          >
            <Swords className="h-4 w-4" /> Return to Battle
          </Button>
        ) : null}
        <Button
          variant="outline"
          className="justify-start border-0 bg-transparent"
          onClick={() => {
            onMainMenu();
            onClose();
          }}
        >
          <House className="h-4 w-4" /> Main Menu
        </Button>
        {currentScreen !== "collection" ? (
          <Button
            variant="outline"
            className="justify-start border-0 bg-transparent"
            onClick={() => {
              onCollection();
              onClose();
            }}
          >
            <BookOpen className="h-4 w-4" /> Collection
          </Button>
        ) : null}
        {currentScreen !== "talents" ? (
          <Button
            variant="outline"
            className="justify-start border-0 bg-transparent"
            onClick={() => {
              onTalents();
              onClose();
            }}
          >
            <WandSparkles className="h-4 w-4" /> Talents
          </Button>
        ) : null}
        {currentScreen !== "homestead" ? (
          <Button
            variant="outline"
            className="justify-start border-0 bg-transparent"
            onClick={() => {
              onHomestead();
              onClose();
            }}
          >
            <TreePine className="h-4 w-4" /> Homestead
          </Button>
        ) : null}
        {currentScreen !== "options" ? (
          <Button
            variant="outline"
            className="justify-start border-0 bg-transparent"
            onClick={() => {
              onOptions();
              onClose();
            }}
          >
            <Cog className="h-4 w-4" /> Options
          </Button>
        ) : null}
        {onEndRun ? (
          <>
            <div className="my-1 border-t border-border/60" />
            <Button
              variant="outline"
              className="justify-start border-0 bg-transparent text-red-400"
              onClick={() => {
                onEndRun();
                onClose();
              }}
            >
              <Swords className="h-4 w-4" /> End Run
            </Button>
          </>
        ) : null}
      </div>
    </div>
  );

  if (anchorRect) {
    const offset = NAVIGATION_CONFIG.anchoredMenuOffsetPx;
    const anchorStyle =
      anchorPlacement === "down-right-of-anchor"
        ? {
            // Menu opens to the right of the anchor, clamped to viewport right edge.
            left: Math.min(
              anchorRect.right + offset,
              window.innerWidth - NAVIGATION_CONFIG.anchoredMenuWidthPx - offset,
            ),
            top: anchorRect.bottom + offset,
          }
        : anchorPlacement === "down-right"
          ? {
              // Right-align below the anchor, but clamp so fixed positioning cannot push the menu off-screen.
              right: Math.min(
                window.innerWidth - anchorRect.right + offset,
                window.innerWidth - NAVIGATION_CONFIG.anchoredMenuWidthPx,
              ),
              top: anchorRect.bottom + offset,
            }
          : {
              right: window.innerWidth - anchorRect.right + offset,
              bottom: window.innerHeight - anchorRect.top + offset,
            };
    return (
      <div className="absolute inset-0 z-[120]" onClick={onClose}>
        <div className="fixed z-[121]" style={anchorStyle}>
          {panel}
        </div>
      </div>
    );
  }

  return (
    <div className="absolute inset-0 z-[120] flex items-center justify-center px-6" onClick={onClose}>
      {panel}
    </div>
  );
}
