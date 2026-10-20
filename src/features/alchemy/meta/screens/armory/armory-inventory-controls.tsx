import { useGameTranslation } from "@/components/use-game-translation";

import { useCallback, useEffect, useRef, useState, type ComponentProps, type ReactNode } from "react";
import { ArrowDownWideNarrow, Search, SlidersHorizontal, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ESCAPE_PRIORITY } from "@/app/escape-stack";
import { ChromeIconButton } from "@/features/alchemy/shared/ui/chrome-icon-button";
import { focusControl } from "@/features/alchemy/shared/ui/focus-navigation";
import { useModalEscapeDismiss } from "@/features/alchemy/shared/ui/use-modal-escape-dismiss";
import { useHoverVisible } from "@/features/alchemy/shared/ui/use-hover-visible";
import { PortaledTooltip } from "@/features/alchemy/shared/ui/tooltips/portaled-tooltip";
import { cn } from "@/lib/utils";
import { ARMORY_FILTER_KEYWORDS, type ArmoryInventoryFilters } from "./armory-inventory-filtering";
import { ArmoryInventoryMenu } from "./armory-inventory-menu";
import type { ArmorySortOption } from "./armory-ordering";

const RARITIES = [
  { id: "unique", label: "Unique" },
  { id: "astral", label: "Astral" },
  { id: "basic", label: "Basic" },
] as const;

function toggleValue<T>(values: T[], value: T): T[] {
  return values.includes(value) ? values.filter((entry) => entry !== value) : [...values, value];
}

function InventoryIconButton({
  label,
  active,
  ref,
  "aria-expanded": expanded,
  ...props
}: ComponentProps<typeof ChromeIconButton> & { label: string }) {
  useGameTranslation();
  const { triggerRef, visible, onMouseEnter, onMouseMove, onMouseLeave, onFocusCapture, onBlurCapture } =
    useHoverVisible({ suspended: Boolean(expanded) });
  return (
    <div
      ref={triggerRef}
      onMouseEnter={onMouseEnter}
      onMouseMove={onMouseMove}
      onMouseLeave={onMouseLeave}
      onFocusCapture={onFocusCapture}
      onBlurCapture={onBlurCapture}
    >
      <ChromeIconButton ref={ref} aria-label={label} aria-expanded={expanded} active={active} {...props} />
      <PortaledTooltip triggerRef={triggerRef} visible={visible} width="w-max">
        {label}
      </PortaledTooltip>
    </div>
  );
}

export function ArmoryInventoryControls({
  filters,
  isTrinket,
  onFiltersChange,
  onSort,
  onBrowse,
}: {
  filters: ArmoryInventoryFilters;
  isTrinket: boolean;
  onFiltersChange: (filters: ArmoryInventoryFilters) => void;
  onSort: (option: ArmorySortOption) => void;
  onBrowse: () => void;
}) {
  const i18n = useGameTranslation();
  const [menu, setMenu] = useState<"filter" | "sort" | null>(null);
  const [searchExpanded, setSearchExpanded] = useState(Boolean(filters.search));
  const searchRef = useRef<HTMLInputElement>(null);
  const searchRequested = useRef(false);
  const searchTriggerRef = useRef<HTMLButtonElement>(null);
  const filterTriggerRef = useRef<HTMLButtonElement>(null);
  const sortTriggerRef = useRef<HTMLButtonElement>(null);
  const filtersActive = filters.keywords.length > 0 || (!isTrinket && filters.rarities.length > 0);
  const closeSearch = () => {
    onFiltersChange({ ...filters, search: "" });
    setSearchExpanded(false);
    if (!focusControl(searchTriggerRef.current)) {
      const active = document.activeElement;
      if (active instanceof HTMLElement && active.closest(".armory-inventory-search-field")) active.blur();
    }
  };
  useModalEscapeDismiss({
    active: searchExpanded && menu === null,
    id: "armory-inventory-search",
    priority: ESCAPE_PRIORITY.DIALOG,
    onEscape: closeSearch,
  });
  useEffect(() => {
    if (searchExpanded && searchRequested.current) {
      searchRequested.current = false;
      searchRef.current?.focus({ preventScroll: true });
    }
  }, [searchExpanded]);
  const dismissFilter = useCallback((restoreFocus: boolean) => {
    setMenu((current) => (current === "filter" ? null : current));
    if (restoreFocus) focusControl(filterTriggerRef.current);
  }, []);
  const dismissSort = useCallback((restoreFocus: boolean) => {
    setMenu((current) => (current === "sort" ? null : current));
    if (restoreFocus) focusControl(sortTriggerRef.current);
  }, []);

  return (
    <div data-testid="armory-inventory-controls" className="armory-inventory-controls" onFocusCapture={onBrowse}>
      <div className="armory-inventory-search" data-expanded={searchExpanded}>
        <InventoryIconButton
          ref={searchTriggerRef}
          label={i18n.text("ui.armory-inventory-controls.1", "Search inventory")}
          active={searchExpanded}
          aria-expanded={searchExpanded}
          onClick={() => {
            setMenu(null);
            if (searchExpanded) searchRef.current?.focus({ preventScroll: true });
            else {
              searchRequested.current = true;
              setSearchExpanded(true);
            }
          }}
        >
          <Search aria-hidden="true" />
        </InventoryIconButton>
        <div className="armory-inventory-search-field" inert={!searchExpanded}>
          <input
            ref={searchRef}
            type="search"
            aria-label={i18n.text("ui.armory-inventory-controls.2", "Search inventory")}
            placeholder={i18n.text("ui.armory-inventory-controls.3", "Search names and effects…")}
            value={filters.search}
            onChange={(event) => onFiltersChange({ ...filters, search: event.target.value })}
            className="h-11 w-full min-w-0 rounded-xl border border-border/80 bg-background pr-9 pl-3 text-sm outline-none placeholder:text-muted-foreground focus:border-primary [&::-webkit-search-cancel-button]:hidden"
          />
          <Button
            variant="ghost"
            size="icon"
            aria-label={i18n.text("ui.armory-inventory-controls.4", "Close inventory search")}
            className="absolute top-1/2 right-1 h-8 w-8 -translate-y-1/2"
            onClick={closeSearch}
          >
            <X aria-hidden="true" />
          </Button>
        </div>
      </div>
      <ArmoryInventoryMenu
        label={i18n.text("ui.armory-inventory-controls.5", "Inventory filters")}
        open={menu === "filter"}
        triggerRef={filterTriggerRef}
        onDismiss={dismissFilter}
        trigger={(panelId) => (
          <InventoryIconButton
            ref={filterTriggerRef}
            label={i18n.text("ui.armory-inventory-controls.6", "Filters")}
            active={menu === "filter" || filtersActive}
            aria-expanded={menu === "filter"}
            aria-controls={menu === "filter" ? panelId : undefined}
            aria-haspopup="dialog"
            onClick={() => setMenu(menu === "filter" ? null : "filter")}
          >
            <SlidersHorizontal aria-hidden="true" />
          </InventoryIconButton>
        )}
      >
        {!isTrinket ? (
          <FilterGroup title={i18n.text("ui.armory-inventory-controls.7", "Rarity")}>
            <div className="flex flex-wrap gap-2">
              {RARITIES.map(({ id, label }) => (
                <Button
                  key={id}
                  variant="outline"
                  size="sm"
                  aria-pressed={filters.rarities.includes(id)}
                  className={cn(
                    "tracking-normal normal-case",
                    filters.rarities.includes(id) && "border-primary bg-primary/10 text-primary",
                  )}
                  onClick={() => onFiltersChange({ ...filters, rarities: toggleValue(filters.rarities, id) })}
                >
                  {i18n.displayText(label)}
                </Button>
              ))}
            </div>
          </FilterGroup>
        ) : null}
        <FilterGroup
          title={i18n.displayText(
            isTrinket
              ? i18n.text("ui.armory-inventory-controls.d1", "Effect Keywords")
              : i18n.text("ui.armory-inventory-controls.d2", "Affix Keywords"),
          )}
        >
          <div className="grid grid-cols-2 gap-1">
            {ARMORY_FILTER_KEYWORDS.map(({ id, label }) => (
              <label
                key={id}
                className="flex min-h-9 cursor-pointer items-center gap-2 rounded-lg px-2 text-sm hover:bg-muted/60"
              >
                <input
                  type="checkbox"
                  checked={filters.keywords.includes(id)}
                  onChange={() => onFiltersChange({ ...filters, keywords: toggleValue(filters.keywords, id) })}
                  className="h-4 w-4 shrink-0 accent-primary"
                />
                {i18n.displayText(label)}
              </label>
            ))}
          </div>
        </FilterGroup>
        <div className="mt-3 border-t border-border/50 pt-3">
          <Button
            variant="ghost"
            size="sm"
            disabled={!filtersActive}
            onClick={() => onFiltersChange({ ...filters, rarities: [], keywords: [] })}
          >
            {i18n.text("ui.armory-inventory-controls.8", "Clear filters")}
          </Button>
        </div>
      </ArmoryInventoryMenu>
      <ArmoryInventoryMenu
        label={i18n.text("ui.armory-inventory-controls.9", "Sort inventory")}
        open={menu === "sort"}
        triggerRef={sortTriggerRef}
        onDismiss={dismissSort}
        trigger={(panelId) => (
          <InventoryIconButton
            ref={sortTriggerRef}
            label={i18n.text("ui.armory-inventory-controls.10", "Sort inventory")}
            active={menu === "sort"}
            aria-expanded={menu === "sort"}
            aria-controls={menu === "sort" ? panelId : undefined}
            aria-haspopup="dialog"
            onClick={() => setMenu(menu === "sort" ? null : "sort")}
          >
            <ArrowDownWideNarrow aria-hidden="true" />
          </InventoryIconButton>
        )}
      >
        <div className="grid gap-1">
          {(
            [
              ...(!isTrinket ? ([{ id: "rarity", label: "Rarity" }] as const) : []),
              { id: "name", label: "Name" },
              ...(!isTrinket ? ([{ id: "base-type", label: "Base Type" }] as const) : []),
            ] as const
          ).map(({ id, label }) => (
            <Button
              key={id}
              variant="ghost"
              size="sm"
              className="justify-start tracking-normal normal-case"
              onClick={() => {
                onSort(id);
                dismissSort(true);
              }}
            >
              {i18n.displayText(label)}
            </Button>
          ))}
        </div>
      </ArmoryInventoryMenu>
    </div>
  );
}

function FilterGroup({ title, children }: { title: string; children: ReactNode }) {
  useGameTranslation();
  return (
    <fieldset className="mb-3">
      <legend className="mb-2 text-sm font-semibold text-muted-foreground">{title}</legend>
      {children}
    </fieldset>
  );
}
