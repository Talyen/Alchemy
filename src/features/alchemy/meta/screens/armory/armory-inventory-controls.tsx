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
  const [menu, setMenu] = useState<"filter" | "sort" | null>(null);
  const [searchExpanded, setSearchExpanded] = useState(Boolean(filters.search));
  const searchRef = useRef<HTMLInputElement>(null);
  const searchTriggerRef = useRef<HTMLButtonElement>(null);
  const filterTriggerRef = useRef<HTMLButtonElement>(null);
  const sortTriggerRef = useRef<HTMLButtonElement>(null);
  const filtersActive = filters.keywords.length > 0 || (!isTrinket && filters.rarities.length > 0);
  const closeSearch = () => {
    onFiltersChange({ ...filters, search: "" });
    setSearchExpanded(false);
    focusControl(searchTriggerRef.current);
  };
  useModalEscapeDismiss({
    active: searchExpanded && menu === null,
    id: "armory-inventory-search",
    priority: ESCAPE_PRIORITY.DIALOG,
    onEscape: closeSearch,
  });
  useEffect(() => {
    if (searchExpanded) focusControl(searchRef.current);
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
          label="Search inventory"
          active={searchExpanded}
          aria-expanded={searchExpanded}
          onClick={() => {
            setMenu(null);
            if (searchExpanded) focusControl(searchRef.current);
            else setSearchExpanded(true);
          }}
        >
          <Search aria-hidden="true" className="h-5 w-5" />
        </InventoryIconButton>
        <div className="armory-inventory-search-field" inert={!searchExpanded}>
          <input
            ref={searchRef}
            type="search"
            aria-label="Search inventory"
            placeholder="Search names and effects…"
            value={filters.search}
            onChange={(event) => onFiltersChange({ ...filters, search: event.target.value })}
            className="h-11 w-full min-w-0 rounded-xl border border-border/80 bg-background pr-9 pl-3 text-sm outline-none placeholder:text-muted-foreground focus:border-primary [&::-webkit-search-cancel-button]:hidden"
          />
          <Button
            variant="ghost"
            size="icon"
            aria-label="Close inventory search"
            className="absolute top-1/2 right-1 h-8 w-8 -translate-y-1/2"
            onClick={closeSearch}
          >
            <X aria-hidden="true" className="h-4 w-4" />
          </Button>
        </div>
      </div>
      <ArmoryInventoryMenu
        label="Inventory filters"
        open={menu === "filter"}
        triggerRef={filterTriggerRef}
        onDismiss={dismissFilter}
        trigger={(panelId) => (
          <InventoryIconButton
            ref={filterTriggerRef}
            label="Filters"
            active={menu === "filter" || filtersActive}
            aria-expanded={menu === "filter"}
            aria-controls={menu === "filter" ? panelId : undefined}
            aria-haspopup="dialog"
            onClick={() => setMenu(menu === "filter" ? null : "filter")}
          >
            <SlidersHorizontal aria-hidden="true" className="h-5 w-5" />
          </InventoryIconButton>
        )}
      >
        {!isTrinket ? (
          <FilterGroup title="Rarity">
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
                  {label}
                </Button>
              ))}
            </div>
          </FilterGroup>
        ) : null}
        <FilterGroup title={isTrinket ? "Effect Keywords" : "Affix Keywords"}>
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
                {label}
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
            Clear filters
          </Button>
        </div>
      </ArmoryInventoryMenu>
      <ArmoryInventoryMenu
        label="Sort inventory"
        open={menu === "sort"}
        triggerRef={sortTriggerRef}
        onDismiss={dismissSort}
        trigger={(panelId) => (
          <InventoryIconButton
            ref={sortTriggerRef}
            label="Sort inventory"
            active={menu === "sort"}
            aria-expanded={menu === "sort"}
            aria-controls={menu === "sort" ? panelId : undefined}
            aria-haspopup="dialog"
            onClick={() => setMenu(menu === "sort" ? null : "sort")}
          >
            <ArrowDownWideNarrow aria-hidden="true" className="h-5 w-5" />
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
              {label}
            </Button>
          ))}
        </div>
      </ArmoryInventoryMenu>
    </div>
  );
}

function FilterGroup({ title, children }: { title: string; children: ReactNode }) {
  return (
    <fieldset className="mb-3">
      <legend className="mb-2 text-sm font-semibold text-muted-foreground">{title}</legend>
      {children}
    </fieldset>
  );
}
