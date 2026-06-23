// Reusable tab bar with rectangular buttons.
import type { ElementType } from "react";
import { cn } from "@/lib/utils";
import { CHIP_BUTTON_CLASS } from "@/features/alchemy/shared/config";
import { PressableMotion } from "./pressable-motion";

export interface TabBarProps<T extends string> {
  tabs: Array<{
    id: T;
    label: string;
    icon: ElementType;
    disabled?: boolean;
    iconClassName?: string;
  }>;
  activeTab: T;
  onSelectTab: (tab: T) => void;
}

export function TabBar<T extends string>({ tabs, activeTab, onSelectTab }: TabBarProps<T>) {
  return (
    <div className="flex flex-wrap justify-center gap-3">
      {tabs.map((tab) => {
        const Icon = tab.icon;
        const isDisabled = tab.disabled ?? false;
        return (
          <PressableMotion key={tab.id} {...(isDisabled ? { hoverSound: false as const } : {})}>
            <button
              type="button"
              disabled={isDisabled}
              onClick={() => !isDisabled && onSelectTab(tab.id)}
              className={cn(
                CHIP_BUTTON_CLASS,
                "shrink-0",
                isDisabled && "cursor-default opacity-50",
                tab.id === activeTab
                  ? "ring-2 ring-primary/70 ring-offset-1 ring-offset-background"
                  : "hover:border-border",
              )}
              aria-label={isDisabled ? `${tab.label} (Locked)` : tab.label}
            >
              <Icon className={cn("h-4 w-4", tab.iconClassName)} />
              {tab.label}
            </button>
          </PressableMotion>
        );
      })}
    </div>
  );
}
