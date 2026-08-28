import { BookOpen, Cog, House, Shield, Swords, TreePine, WandSparkles } from "lucide-react";
import { Fragment } from "react";
import { getProgressionFeatureUnlockMessage } from "@/lib/game-data";
import { cn } from "@/lib/utils";
import type { Screen } from "@/lib/routing";
import { useHeldWhile } from "./fade-presence";
import { LockedMenuItem } from "./locked-menu-item";
import { ModalOverlayShell } from "./modal-overlay-shell";

const GAME_MENU_CONFIG = {
  anchoredMenuOffsetPx: 8,
  anchoredMenuWidthPx: 392,
} as const;

type Gate = "talents" | "homestead" | "armory";

interface GameMenuProps {
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
}

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

interface BuildMenuItemsArgs {
  onClose: () => void;
  onMainMenu: () => void;
  onCollection: () => void;
  onTalents: () => void;
  onHomestead: () => void;
  onArmory: () => void;
  onOptions: () => void;
  onEndRun: (() => void) | undefined;
  onReturnToRun: (() => void) | undefined;
  returnToRunLabel: "Return to Run" | "Return to Battle";
  currentScreen: Screen | undefined;
}

function buildMenuItems({
  onClose,
  onMainMenu,
  onCollection,
  onTalents,
  onHomestead,
  onArmory,
  onOptions,
  onEndRun,
  onReturnToRun,
  returnToRunLabel,
  currentScreen,
}: BuildMenuItemsArgs): MenuItem[] {
  const closeAfter = (action: () => void) => () => {
    action();
    onClose();
  };

  return [
    {
      key: "return-to-run",
      label: returnToRunLabel ?? "Return to Run",
      Icon: Swords,
      show: !!onReturnToRun,
      handler: closeAfter(() => onReturnToRun?.()),
    },
    { key: "main-menu", label: "Main Menu", Icon: House, show: true, handler: closeAfter(onMainMenu) },
    {
      key: "collection",
      label: "Collection",
      Icon: BookOpen,
      show: currentScreen !== "collection",
      handler: closeAfter(onCollection),
    },
    {
      key: "talents",
      label: "Talents",
      Icon: WandSparkles,
      gate: "talents",
      show: currentScreen !== "talents",
      handler: closeAfter(onTalents),
    },
    {
      key: "homestead",
      label: "Homestead",
      Icon: TreePine,
      gate: "homestead",
      show: currentScreen !== "homestead",
      handler: closeAfter(onHomestead),
    },
    {
      key: "armory",
      label: "Armory",
      Icon: Shield,
      gate: "armory",
      show: currentScreen !== "armory",
      handler: closeAfter(onArmory),
    },
    {
      key: "options",
      label: "Options",
      Icon: Cog,
      show: currentScreen !== "options",
      handler: closeAfter(onOptions),
    },
    {
      key: "end-run",
      label: "End Run",
      Icon: Swords,
      danger: true,
      dividerBefore: true,
      show: !!onEndRun,
      handler: closeAfter(() => onEndRun?.()),
    },
  ];
}

function GameMenuPanel({
  items,
  locks,
  messages,
}: {
  items: MenuItem[];
  locks: Record<Gate, boolean>;
  messages: Record<Gate, string>;
}) {
  return (
    <div
      data-testid="game-menu"
      className="motion-panel alchemy-shell w-full max-w-[42.67cqh] overflow-visible rounded-shell-dialog border border-border/80 px-5 py-4"
      onClick={(e) => e.stopPropagation()}
    >
      <div className="grid gap-0.5">
        {items
          .filter((item) => item.show)
          .map((item) => (
            <Fragment key={item.key}>
              {item.dividerBefore && <div className="my-0.5 border-t border-border/60" />}
              <LockedMenuItem
                title={item.label}
                message={item.gate ? messages[item.gate] : ""}
                locked={item.gate ? locks[item.gate] : false}
                onSelect={item.handler}
                icon={<item.Icon className="h-4 w-4" />}
                className={cn("h-11 justify-start", item.danger && "text-red-400")}
              >
                {item.label}
              </LockedMenuItem>
            </Fragment>
          ))}
      </div>
    </div>
  );
}

function anchoredMenuStyle(anchorRect: DOMRect): React.CSSProperties {
  const offset = GAME_MENU_CONFIG.anchoredMenuOffsetPx;
  return {
    right: Math.min(
      window.innerWidth - anchorRect.right + offset,
      window.innerWidth - GAME_MENU_CONFIG.anchoredMenuWidthPx,
    ),
    top: anchorRect.bottom + offset,
  };
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
}: GameMenuProps) {
  const layoutAnchorRect = useHeldWhile(isOpen, anchorRect ?? null);

  const panel = (
    <GameMenuPanel
      items={buildMenuItems({
        onClose,
        onMainMenu,
        onCollection,
        onTalents,
        onHomestead,
        onArmory,
        onOptions,
        onEndRun,
        onReturnToRun,
        returnToRunLabel,
        currentScreen,
      })}
      locks={{ talents: isTalentsLocked, homestead: isHomesteadLocked, armory: isArmoryLocked }}
      messages={{
        talents: getProgressionFeatureUnlockMessage("talents"),
        homestead: getProgressionFeatureUnlockMessage("homestead"),
        armory: "Find Gear to unlock",
      }}
    />
  );

  return (
    <ModalOverlayShell
      open={isOpen}
      escapeId="game-menu"
      onClose={onClose}
      dismissOnEscape={false}
      dismissOnBackdrop
      dim={false}
      zIndex={120}
      className={cn(!isOpen && "pointer-events-none", !layoutAnchorRect && "flex items-center justify-center px-6")}
    >
      {layoutAnchorRect ? (
        <div className="fixed z-[121]" style={anchoredMenuStyle(layoutAnchorRect)}>
          {panel}
        </div>
      ) : (
        panel
      )}
    </ModalOverlayShell>
  );
}
