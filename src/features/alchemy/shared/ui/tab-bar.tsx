// Reusable tab bar with pill-shaped buttons.
import type { ElementType } from "react";
import { cn } from "@/lib/utils";
import { PressableMotion } from "./pressable-motion";

export function TabBar<T extends string>({
  tabs,
  activeTab,
  onSelectTab,
}: {
  tabs: { id: T; label: string; icon: ElementType }[];
  activeTab: T;
  onSelectTab: (tab: T) => void;
}) {
  return (
    <div className="flex flex-wrap justify-center gap-3">
      {tabs.map((tab) => {
        const Icon = tab.icon;
        return (
          <PressableMotion key={tab.id} disableHoverScale>
            <button
              type="button"
              onClick={() => onSelectTab(tab.id)}
              className={cn(
                "inline-flex items-center gap-2 rounded-full bg-card px-4 py-2 text-sm font-semibold text-foreground ring-1 ring-offset-1 ring-offset-card transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
                activeTab === tab.id ? "ring-primary/70" : "ring-border/30 hover:ring-border/50",
              )}
            >
              <Icon className="h-4 w-4" />
              {tab.label}
            </button>
          </PressableMotion>
        );
      })}
    </div>
  );
}
