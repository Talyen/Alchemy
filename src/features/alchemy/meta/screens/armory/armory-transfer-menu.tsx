import { useCallback, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { characters, isCharacterUnlocked, type CharacterId } from "@/lib/game-data";
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
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onClose();
        event.preventDefault();
        event.stopPropagation();
      }
    }

    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        onClose();
      }
    }

    window.addEventListener("keydown", handleKeyDown, true);
    document.addEventListener("click", handleClickOutside);
    return () => {
      window.removeEventListener("keydown", handleKeyDown, true);
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
        "fixed z-[150] min-w-[10rem] overflow-hidden rounded-lg border border-border bg-card shadow-[0_10px_40px_rgba(0,0,0,0.5)]",
        "py-1",
      )}
      style={{ left, top }}
      data-testid="armory-transfer-menu"
    >
      {recipients.map((targetId) => (
        <button
          key={targetId}
          role="menuitem"
          className={cn(
            "flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm transition-colors",
            "text-stone-200 hover:bg-stone-800/80 hover:text-amber-100",
          )}
          onClick={() => handleClick(targetId)}
        >
          <span>Send to {characters[targetId].name}</span>
        </button>
      ))}
    </div>,
    document.body,
  );
}
