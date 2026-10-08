import { BookOpen, Cog, House, Shield, Swords, TreePine, WandSparkles } from "lucide-react";
import { Fragment, type ReactNode } from "react";
import { getProgressionFeatureUnlockMessage } from "@/lib/game-data";
import { cn } from "@/lib/utils";
import type { Screen } from "@/lib/routing";
import { controlLabelClass } from "../config/typography";
import { useHeldWhile } from "./use-fade";
import { LockedMenuItem } from "./locked-menu-item";
import { ModalOverlayShell } from "./modal-overlay-shell";
import { useDialogFocus } from "./use-dialog-focus";

const GAME_MENU_CONFIG = {
  anchoredMenuOffsetPx: 8,
  anchoredMenuWidthPx: 392,
} as const;

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
}

interface MenuItem {
  key: string;
  label: string;
  Icon: typeof Swords;
  iconClassName?: string;
  onSelect: (() => void) | undefined;
  lock?: { locked: boolean; message: string };
  danger?: boolean;
}

function anchoredMenuStyle(anchorRect: DOMRect): React.CSSProperties {
  const offset = GAME_MENU_CONFIG.anchoredMenuOffsetPx;
  const top = Math.max(offset, Math.min(anchorRect.bottom + offset, window.innerHeight / 2));
  return {
    right: Math.max(
      offset,
      Math.min(window.innerWidth - anchorRect.right + offset, window.innerWidth - GAME_MENU_CONFIG.anchoredMenuWidthPx),
    ),
    top,
    maxWidth: `calc(100vw - ${offset * 2}px)`,
    maxHeight: `calc(100dvh - ${top + offset}px)`,
    overflowY: "auto",
  };
}

function GameMenuPanel({ children }: { children: ReactNode }) {
  const { panelRef, handleKeyDown } = useDialogFocus();
  return (
    // oxlint-disable-next-line jsx-a11y/no-noninteractive-element-interactions -- Modal contains focus and shields its backdrop from content clicks
    <div
      ref={panelRef}
      role="dialog"
      aria-modal="true"
      aria-label="Game menu"
      tabIndex={-1}
      data-testid="game-menu"
      onKeyDown={handleKeyDown}
      className="alchemy-shell w-full max-w-[calc(28.8023*var(--content-rem,1rem))] overflow-visible rounded-shell-dialog border border-border/80 px-5 py-4"
      onClick={(event) => event.stopPropagation()}
    >
      {children}
    </div>
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
}: GameMenuProps) {
  const layoutAnchorRect = useHeldWhile(isOpen, anchorRect ?? null);
  const items: MenuItem[] = [
    { key: "return-to-run", label: returnToRunLabel, Icon: Swords, onSelect: onReturnToRun },
    { key: "main-menu", label: "Main Menu", Icon: House, onSelect: onMainMenu },
    {
      key: "collection",
      label: "Collection",
      Icon: BookOpen,
      iconClassName: "text-gold-light",
      onSelect: onCollection,
    },
    {
      key: "talents",
      label: "Talents",
      Icon: WandSparkles,
      iconClassName: "text-violet-400",
      onSelect: onTalents,
      lock: { locked: isTalentsLocked, message: getProgressionFeatureUnlockMessage("talents") },
    },
    {
      key: "homestead",
      label: "Homestead",
      Icon: TreePine,
      iconClassName: "text-emerald-400",
      onSelect: onHomestead,
      lock: { locked: isHomesteadLocked, message: getProgressionFeatureUnlockMessage("homestead") },
    },
    { key: "armory", label: "Armory", Icon: Shield, iconClassName: "text-sky-300", onSelect: onArmory },
    { key: "options", label: "Options", Icon: Cog, iconClassName: "text-zinc-400", onSelect: onOptions },
    { key: "end-run", label: "End Run", Icon: Swords, onSelect: onEndRun, danger: true },
  ];

  const panel = (
    <GameMenuPanel>
      <div className="grid gap-0.5">
        {items.map(({ key, label, Icon, iconClassName, onSelect, lock, danger }) => {
          if (!onSelect || key === currentScreen) return null;
          return (
            <Fragment key={key}>
              {danger && <div className="my-0.5 border-t border-border/60" />}
              <LockedMenuItem
                title={label}
                message={lock?.message ?? ""}
                locked={lock?.locked ?? false}
                onSelect={() => {
                  onSelect();
                  onClose();
                }}
                icon={<Icon className={cn("h-6 w-6 shrink-0", iconClassName)} />}
                className={cn(controlLabelClass, "h-11 w-full justify-start gap-3", danger && "text-red-400")}
              >
                {label}
              </LockedMenuItem>
            </Fragment>
          );
        })}
      </div>
    </GameMenuPanel>
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
      className={cn(!layoutAnchorRect && "flex items-center justify-center px-6")}
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
