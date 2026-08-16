// Reusable tab bar with rectangular buttons.
import type { ElementType } from "react";
import { cn } from "@/lib/utils";
import { CHIP_BUTTON_CLASS } from "@/features/alchemy/shared/config";

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
  activeClassName?: string;
}

export function TabBar<T extends string>({
  tabs,
  activeTab,
  onSelectTab,
  activeClassName = "ring-2 ring-primary/70 ring-offset-1 ring-offset-background",
}: TabBarProps<T>) {
  return (
    <div className="flex flex-wrap justify-center gap-3">
      {tabs.map((tab) => {
        const Icon = tab.icon;
        const isDisabled = tab.disabled ?? false;
        return (
          <button
            key={tab.id}
            type="button"
            disabled={isDisabled}
            onClick={() => !isDisabled && onSelectTab(tab.id)}
            className={cn(
              CHIP_BUTTON_CLASS,
              "shrink-0",
              isDisabled && "cursor-default opacity-50",
              tab.id === activeTab ? activeClassName : "hover:border-border",
            )}
            aria-label={isDisabled ? `${tab.label} (Locked)` : tab.label}
          >
            <Icon className={cn("h-6 w-6", tab.iconClassName)} />
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}
