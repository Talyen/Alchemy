import { useCallback, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { ESCAPE_PRIORITY, pushEscapeHandler } from "@/app/escape-stack";
import { Button } from "@/components/ui/button";
import { characters, isCharacterUnlocked, type CharacterId } from "@/features/alchemy/shared/config/game-data-catalog";
import { cn } from "@/lib/utils";

export interface TransferMenuState {
  instanceId: string;
  sourceCharacterId: CharacterId;
  anchor: { x: number; y: number };
}

export function ArmoryTransferMenu({
  transferMenu,
  finishedRunCharacters,
  onTransferGear,
  onClose,
}: {
  transferMenu: TransferMenuState;
  finishedRunCharacters: CharacterId[];
  onTransferGear: (instanceId: string, targetCharacterId: CharacterId) => boolean;
  onClose: () => void;
}) {
  const menuRef = useRef<HTMLDivElement>(null);

  const handleClick = useCallback(
    (targetId: CharacterId) => {
      onTransferGear(transferMenu.instanceId, targetId);
      onClose();
    },
    [transferMenu, onClose, onTransferGear],
  );

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        onClose();
      }
    }

    const unsubscribeEscape = pushEscapeHandler({
      id: "armory-transfer-menu",
      priority: ESCAPE_PRIORITY.MODAL,
      onEscape: () => onClose(),
    });
    document.addEventListener("click", handleClickOutside);
    return () => {
      unsubscribeEscape();
      document.removeEventListener("click", handleClickOutside);
    };
  }, [transferMenu, onClose]);

  const { sourceCharacterId, anchor } = transferMenu;

  const recipients = (Object.keys(characters) as CharacterId[])
    .filter((id) => id !== sourceCharacterId)
    .filter((id) => isCharacterUnlocked(id, finishedRunCharacters));

  let left = anchor.x;
  let top = anchor.y;
  if (typeof window !== "undefined") {
    const menuWidth = 180;
    const menuItemHeight = 36;
    const menuHeight = recipients.length * menuItemHeight + 8;
    if (left + menuWidth > window.innerWidth) left = window.innerWidth - menuWidth - 8;
    if (top + menuHeight > window.innerHeight) top = window.innerHeight - menuHeight - 8;
    if (left < 0) left = 8;
    if (top < 0) top = 8;
  }

  return createPortal(
    <div
      ref={menuRef}
      role="menu"
      className={cn(
        "fixed z-[150] min-w-40 overflow-hidden rounded-lg border border-border bg-card shadow-[0_10px_40px_rgba(0,0,0,0.5)]",
        "py-1",
      )}
      style={{ left, top }}
      data-testid="armory-transfer-menu"
    >
      {recipients.map((targetId) => (
        <Button
          key={targetId}
          asChild
          type="button"
          variant="ghost"
          size="sm"
          hoverSound={false}
          className="h-auto w-full justify-start gap-2 rounded-none px-3 py-1.5 text-left text-sm font-normal tracking-normal text-foreground normal-case hover:text-amber-100"
          onClick={() => handleClick(targetId)}
        >
          <button type="button" role="menuitem">
            <span>Send to {characters[targetId].name}</span>
          </button>
        </Button>
      ))}
    </div>,
    document.body,
  );
}
