import { BookOpen, ChevronLeft, ChevronRight, Cog, House, Swords, TreePine, WandSparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

export function PaginationControls({ page, totalPages, onPageChange, size = "sm", reserveSpace = false }: { page: number; totalPages: number; onPageChange: (page: number) => void; size?: "sm" | "default"; reserveSpace?: boolean }) {
  const buttonClass = size === "sm" ? "h-9 w-9" : "h-11 w-11";
  const widthClass = size === "sm" ? "max-w-28" : "max-w-36";

  if (totalPages <= 1) {
    return reserveSpace ? <div className={cn("mt-4 min-h-[44px] w-full", widthClass)} aria-hidden="true" /> : null;
  }

  return (
    <div className={cn("mt-4 flex min-h-[44px] w-full items-center justify-center gap-4", widthClass)}>
      <Button aria-label="Previous page" className={buttonClass} variant="outline" size="icon" disabled={page === 0} onClick={() => onPageChange(page - 1)}>
        <ChevronLeft className="h-5 w-5" />
      </Button>
      <Button aria-label="Next page" className={buttonClass} variant="outline" size="icon" disabled={page >= totalPages - 1} onClick={() => onPageChange(page + 1)}>
        <ChevronRight className="h-5 w-5" />
      </Button>
    </div>
  );
}

export function GameMenu({ isOpen, onClose, onMainMenu, onCollection, onTalents, onHomestead, onOptions, onEndRun, anchorRect }: { isOpen: boolean; onClose: () => void; onMainMenu: () => void; onCollection: () => void; onTalents: () => void; onHomestead: () => void; onOptions: () => void; onEndRun?: () => void; anchorRect?: DOMRect | null }) {
  if (!isOpen) return null;

  const panel = (
    <div className="motion-panel alchemy-shell bg-[#0c0a07] w-full max-w-sm rounded-[26px] border border-border/80 px-4 py-5" onClick={(e) => e.stopPropagation()}>
      <div className="grid gap-2">
        <Button variant="ghost" className="justify-start" onClick={() => { onMainMenu(); onClose(); }}>
          <House className="h-4 w-4" /> Main Menu
        </Button>
        <Button variant="ghost" className="justify-start" onClick={() => { onCollection(); onClose(); }}>
          <BookOpen className="h-4 w-4" /> Collection
        </Button>
        <Button variant="ghost" className="justify-start" onClick={() => { onTalents(); onClose(); }}>
          <WandSparkles className="h-4 w-4" /> Talents
        </Button>
        <Button variant="ghost" className="justify-start" onClick={() => { onHomestead(); onClose(); }}>
          <TreePine className="h-4 w-4" /> Homestead
        </Button>
        <Button variant="ghost" className="justify-start" onClick={() => { onOptions(); onClose(); }}>
          <Cog className="h-4 w-4" /> Options
        </Button>
        {onEndRun ? (
          <>
            <div className="my-1 border-t border-border/60" />
            <Button variant="ghost" className="justify-start text-red-400 hover:text-red-300 hover:bg-red-950/40" onClick={() => { onEndRun(); onClose(); }}>
              <Swords className="h-4 w-4" /> End Run
            </Button>
          </>
        ) : null}
      </div>
    </div>
  );

  if (anchorRect) {
    return (
      <div className="absolute inset-0 z-[120]" onClick={onClose}>
        <div
          className="fixed z-[121]"
          style={{
            right: window.innerWidth - anchorRect.right + 8,
            bottom: window.innerHeight - anchorRect.top + 8,
          }}
        >
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
