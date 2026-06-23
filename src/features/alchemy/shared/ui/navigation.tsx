// Navigation controls for pagination and the in-game menu overlay.
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
import { Fragment } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import type { Screen } from "../types";
import { LockedMenuItem } from "./locked-menu-item";
import { KNIGHT_UNLOCK_MESSAGE } from "@/lib/game-data/character-unlocks";

const NAVIGATION_CONFIG = {
  paginationMinHeightClass: "min-h-[4.07cqh]",
  anchoredMenuOffsetPx: 8,
  anchoredMenuWidthPx: 392,
} as const;

type Gate = "talents" | "homestead" | "armory";

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
  currentScreen?: Screen;
  isTalentsLocked?: boolean;
  isHomesteadLocked?: boolean;
  isArmoryLocked?: boolean;
}) {
  if (!isOpen) return null;

  const LOCKS: Record<Gate, boolean> = {
    talents: isTalentsLocked,
    homestead: isHomesteadLocked,
    armory: isArmoryLocked,
  };
  const MESSAGES: Record<Gate, string> = {
    talents: KNIGHT_UNLOCK_MESSAGE,
    homestead: KNIGHT_UNLOCK_MESSAGE,
    armory: "Find Gear to unlock",
  };

  interface MenuItem {
    key: string;
    label: string;
    Icon: typeof Swords;
    show: boolean;
    gate?: Gate;
    danger?: boolean;
    dividerBefore?: boolean;
    handler: () => void;
  }

  const items: MenuItem[] = [
    {
      key: "return-to-run",
      label: returnToRunLabel,
      Icon: Swords,
      show: !!onReturnToRun,
      handler: () => {
        onReturnToRun?.();
        onClose();
      },
    },
    {
      key: "main-menu",
      label: "Main Menu",
      Icon: House,
      show: true,
      handler: () => {
        onMainMenu();
        onClose();
      },
    },
    {
      key: "collection",
      label: "Collection",
      Icon: BookOpen,
      show: currentScreen !== "collection",
      handler: () => {
        onCollection();
        onClose();
      },
    },
    {
      key: "talents",
      label: "Talents",
      Icon: WandSparkles,
      gate: "talents",
      show: currentScreen !== "talents",
      handler: () => {
        onTalents();
        onClose();
      },
    },
    {
      key: "homestead",
      label: "Homestead",
      Icon: TreePine,
      gate: "homestead",
      show: currentScreen !== "homestead",
      handler: () => {
        onHomestead();
        onClose();
      },
    },
    {
      key: "armory",
      label: "Armory",
      Icon: Shield,
      gate: "armory",
      show: currentScreen !== "armory",
      handler: () => {
        onArmory();
        onClose();
      },
    },
    {
      key: "options",
      label: "Options",
      Icon: Cog,
      show: currentScreen !== "options",
      handler: () => {
        onOptions();
        onClose();
      },
    },
    {
      key: "end-run",
      label: "End Run",
      Icon: Swords,
      danger: true,
      dividerBefore: true,
      show: !!onEndRun,
      handler: () => {
        onEndRun?.();
        onClose();
      },
    },
  ];

  const panel = (
    <div
      data-testid="game-menu"
      className="motion-panel alchemy-shell w-full max-w-[35.56cqh] overflow-visible rounded-shell-dialog border border-border/80 px-4 py-5"
      onClick={(e) => e.stopPropagation()}
    >
      <div className="grid gap-2">
        {items
          .filter((i) => i.show)
          .map((item) => (
            <Fragment key={item.key}>
              {item.dividerBefore && <div className="my-1 border-t border-border/60" />}
              <LockedMenuItem
                title={item.label}
                message={item.gate ? MESSAGES[item.gate] : ""}
                locked={item.gate ? LOCKS[item.gate] : false}
                onSelect={item.handler}
                icon={<item.Icon className="h-4 w-4" />}
                className={cn("justify-start", item.danger && "text-red-400")}
              >
                {item.label}
              </LockedMenuItem>
            </Fragment>
          ))}
      </div>
    </div>
  );

  if (anchorRect) {
    const offset = NAVIGATION_CONFIG.anchoredMenuOffsetPx;
    const anchorStyle = {
      right: Math.min(
        window.innerWidth - anchorRect.right + offset,
        window.innerWidth - NAVIGATION_CONFIG.anchoredMenuWidthPx,
      ),
      top: anchorRect.bottom + offset,
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
