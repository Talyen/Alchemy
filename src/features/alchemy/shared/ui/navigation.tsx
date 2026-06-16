// Navigation controls for pagination and the in-game menu overlay.
// Depends on shared Button styling, Lucide icons, and direct viewport anchoring.
// Used by collection-style grids and battle/menu screens.
import {
  BookOpen,
  ChevronLeft,
  ChevronRight,
  Cog,
  House,
  Menu,
  Shield,
  Swords,
  TreePine,
  WandSparkles,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import type { Screen } from "../types";
import { playUISound } from "@/lib/audio";
import { tooltipSideAnchorClass, useTooltipSidePlacement } from "./tooltip-panel";
import { LockedFeatureTooltip } from "./locked-feature-tooltip";
import { useState } from "react";

import { KNIGHT_UNLOCK_MESSAGE } from "@/lib/game-data/character-unlocks";

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
  onArmory,
  onOptions,
  onEndRun,
  onReturnToRun,
  returnToRunLabel = "Return to Run",
  anchorRect,
  anchorPlacement = "up-left",
  currentScreen,
  isTalentsLocked = false,
  isHomesteadLocked = false,
  isArmoryLocked = false,
}: {
  isOpen: boolean;
  onClose: () => void;
  onMainMenu: () => void;
  onCollection: () => void;
  onTalents: () => void;
  onHomestead: () => void;
  onArmory: () => void;
  onOptions: () => void;
  onEndRun?: () => void;
  onReturnToRun?: () => void;
  returnToRunLabel?: "Return to Run" | "Return to Battle";
  anchorRect?: DOMRect | null;
  anchorPlacement?: "up-left" | "down-right" | "down-right-of-anchor";
  currentScreen?: Screen;
  isTalentsLocked?: boolean;
  isHomesteadLocked?: boolean;
  isArmoryLocked?: boolean;
}) {
  const [showTalentsTooltip, setShowTalentsTooltip] = useState(false);
  const { ref: talentsTooltipRef, placement: talentsTooltipPlacement } = useTooltipSidePlacement(
    "side-end",
    showTalentsTooltip,
  );

  const [showHomesteadTooltip, setShowHomesteadTooltip] = useState(false);
  const { ref: homesteadTooltipRef, placement: homesteadTooltipPlacement } = useTooltipSidePlacement(
    "side-end",
    showHomesteadTooltip,
  );

  const [showArmoryTooltip, setShowArmoryTooltip] = useState(false);
  const { ref: armoryTooltipRef, placement: armoryTooltipPlacement } = useTooltipSidePlacement(
    "side-end",
    showArmoryTooltip,
  );

  if (!isOpen) return null;

  const panel = (
    <div
      data-testid="game-menu"
      className="motion-panel alchemy-shell w-full max-w-[35.56cqh] overflow-visible rounded-shell-dialog border border-border/80 px-4 py-5"
      onClick={(e) => e.stopPropagation()}
    >
      <div className="grid gap-2">
        {onReturnToRun ? (
          <Button
            variant="outline"
            className="justify-start border-0 bg-transparent"
            onClick={() => {
              onReturnToRun();
              onClose();
            }}
          >
            <Swords className="h-4 w-4" /> {returnToRunLabel}
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
          <div
            className="relative overflow-visible"
            onMouseEnter={() => isTalentsLocked && setShowTalentsTooltip(true)}
            onMouseLeave={() => setShowTalentsTooltip(false)}
          >
            <Button
              variant="outline"
              className={cn(
                "justify-start border-0 bg-transparent w-full",
                isTalentsLocked && "opacity-50 hover:bg-transparent cursor-not-allowed",
              )}
              onClick={() => {
                if (isTalentsLocked) {
                  playUISound("error");
                } else {
                  onTalents();
                  onClose();
                }
              }}
            >
              <WandSparkles className="h-4 w-4" /> Talents
            </Button>
            {showTalentsTooltip && isTalentsLocked && (
              <LockedFeatureTooltip
                title="Talents"
                message={KNIGHT_UNLOCK_MESSAGE}
                panelRef={talentsTooltipRef}
                visible
                placement={talentsTooltipPlacement}
                className={cn(tooltipSideAnchorClass(talentsTooltipPlacement), "z-[130] text-left")}
              />
            )}
          </div>
        ) : null}
        {currentScreen !== "homestead" ? (
          <div
            className="relative overflow-visible"
            onMouseEnter={() => isHomesteadLocked && setShowHomesteadTooltip(true)}
            onMouseLeave={() => setShowHomesteadTooltip(false)}
          >
            <Button
              variant="outline"
              className={cn(
                "justify-start border-0 bg-transparent w-full",
                isHomesteadLocked && "opacity-50 hover:bg-transparent cursor-not-allowed",
              )}
              onClick={() => {
                if (isHomesteadLocked) {
                  playUISound("error");
                } else {
                  onHomestead();
                  onClose();
                }
              }}
            >
              <TreePine className="h-4 w-4" /> Homestead
            </Button>
            {showHomesteadTooltip && isHomesteadLocked && (
              <LockedFeatureTooltip
                title="Homestead"
                message={KNIGHT_UNLOCK_MESSAGE}
                panelRef={homesteadTooltipRef}
                visible
                placement={homesteadTooltipPlacement}
                className={cn(tooltipSideAnchorClass(homesteadTooltipPlacement), "z-[130] text-left")}
              />
            )}
          </div>
        ) : null}
        {currentScreen !== "armory" ? (
          <div
            className="relative overflow-visible"
            onMouseEnter={() => isArmoryLocked && setShowArmoryTooltip(true)}
            onMouseLeave={() => setShowArmoryTooltip(false)}
          >
            <Button
              variant="outline"
              disabled={isArmoryLocked}
              className={cn(
                "justify-start border-0 bg-transparent w-full",
                isArmoryLocked && "opacity-50 hover:bg-transparent cursor-not-allowed",
              )}
              onClick={() => {
                onArmory();
                onClose();
              }}
            >
              <Shield className="h-4 w-4" /> Armory
            </Button>
            {showArmoryTooltip && isArmoryLocked && (
              <LockedFeatureTooltip
                title="Armory"
                message="Find Gear to unlock"
                panelRef={armoryTooltipRef}
                visible
                placement={armoryTooltipPlacement}
                className={cn(tooltipSideAnchorClass(armoryTooltipPlacement), "z-[130] text-left")}
              />
            )}
          </div>
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
        {/* anchorStyle: viewport-clamped fixed position from getBoundingClientRect — not expressible as static utilities */}
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
