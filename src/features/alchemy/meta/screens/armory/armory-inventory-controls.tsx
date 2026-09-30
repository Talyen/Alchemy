import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { ArrowDownAZ, Search, SlidersHorizontal, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger } from "@/components/ui/select";
import { ESCAPE_PRIORITY } from "@/app/escape-stack";
import { focusControl } from "@/features/alchemy/shared/ui/focus-navigation";
import { useModalEscapeDismiss } from "@/features/alchemy/shared/ui/use-modal-escape-dismiss";
import { useSelectDismiss } from "@/features/alchemy/shared/ui/use-select-dismiss";
import { cn } from "@/lib/utils";
import {
  ARMORY_FILTER_KEYWORDS,
  DEFAULT_ARMORY_INVENTORY_FILTERS,
  hasArmoryCriteria,
  type ArmoryInventoryFilters,
} from "./armory-inventory-filtering";
import type { ArmorySortOption } from "./armory-ordering";

const RARITIES = [
  { id: "unique", label: "Unique" },
  { id: "astral", label: "Astral" },
  { id: "basic", label: "Basic" },
] as const;

function toggleValue<T>(values: T[], value: T): T[] {
  return values.includes(value) ? values.filter((entry) => entry !== value) : [...values, value];
}

export function ArmoryInventoryControls({
  filters,
  isTrinket,
  matchCount,
  totalCount,
  onFiltersChange,
  onSort,
  onBrowse,
}: {
  filters: ArmoryInventoryFilters;
  isTrinket: boolean;
  matchCount: number;
  totalCount: number;
  onFiltersChange: (filters: ArmoryInventoryFilters) => void;
  onSort: (option: ArmorySortOption) => void;
  onBrowse: () => void;
}) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const filterRegionRef = useRef<HTMLDivElement>(null);
  const panelId = useId();
  const selectDismiss = useSelectDismiss();
  const activeCount =
    (isTrinket ? 0 : filters.rarities.length) + filters.keywords.length + Number(filters.equipment !== null);
  const hasCriteria = hasArmoryCriteria(filters, isTrinket);
  const reset = () => onFiltersChange(DEFAULT_ARMORY_INVENTORY_FILTERS);
  const close = () => {
    setOpen(false);
    focusControl(triggerRef.current);
  };
  useModalEscapeDismiss({ active: open, id: "armory-filters", priority: ESCAPE_PRIORITY.DIALOG, onEscape: close });

  useEffect(() => {
    if (!open) return;
    const region = filterRegionRef.current;
    focusControl(region?.querySelector<HTMLElement>("[data-filter-close]") ?? null);
    function dismissOutside(event: PointerEvent) {
      if (event.target instanceof Node && !region?.contains(event.target)) setOpen(false);
    }
    document.addEventListener("pointerdown", dismissOutside);
    return () => document.removeEventListener("pointerdown", dismissOutside);
  }, [open]);

  return (
    <div data-testid="armory-inventory-controls" className="armory-inventory-controls" onFocusCapture={onBrowse}>
      <div className="armory-inventory-summary">
        {hasCriteria ? (
          <>
            <span role="status" className="shrink-0 text-xs text-muted-foreground">
              {matchCount} of {totalCount} items
            </span>
            {filters.search.trim() ? (
              <CriteriaChip
                label={`“${filters.search.trim().replace(/\s+/g, " ")}”`}
                onRemove={() => onFiltersChange({ ...filters, search: "" })}
              />
            ) : null}
            {!isTrinket
              ? RARITIES.filter(({ id }) => filters.rarities.includes(id)).map(({ id, label }) => (
                  <CriteriaChip
                    key={id}
                    label={label}
                    onRemove={() => onFiltersChange({ ...filters, rarities: toggleValue(filters.rarities, id) })}
                  />
                ))
              : null}
            {filters.keywords.map((id) => (
              <CriteriaChip
                key={id}
                label={ARMORY_FILTER_KEYWORDS.find((entry) => entry.id === id)?.label ?? id}
                onRemove={() => onFiltersChange({ ...filters, keywords: toggleValue(filters.keywords, id) })}
              />
            ))}
            {filters.equipment ? (
              <CriteriaChip
                label={filters.equipment === "equipped" ? "Equipped" : "Unequipped"}
                onRemove={() => onFiltersChange({ ...filters, equipment: null })}
              />
            ) : null}
            <button
              type="button"
              className="focus-visible:ring-ring shrink-0 rounded px-1 text-xs text-primary hover:underline focus-visible:ring-2"
              onClick={reset}
            >
              Clear all
            </button>
          </>
        ) : null}
      </div>
      <div className="flex flex-wrap items-center justify-center gap-2">
        <label className="armory-inventory-search relative">
          <Search
            aria-hidden="true"
            className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-muted-foreground"
          />
          <input
            type="search"
            aria-label="Search inventory"
            placeholder="Search names and effects…"
            value={filters.search}
            onChange={(event) => onFiltersChange({ ...filters, search: event.target.value })}
            className="h-10 w-full rounded-xl border border-border/80 bg-background/80 pr-9 pl-9 text-sm transition-colors outline-none placeholder:text-muted-foreground focus:border-primary [&::-webkit-search-cancel-button]:hidden"
          />
          {filters.search ? (
            <button
              type="button"
              aria-label="Clear inventory search"
              className="focus-visible:ring-ring absolute top-1/2 right-2 -translate-y-1/2 rounded p-1 text-muted-foreground hover:text-foreground focus-visible:ring-2"
              onClick={() => onFiltersChange({ ...filters, search: "" })}
            >
              <X aria-hidden="true" className="h-4 w-4" />
            </button>
          ) : null}
        </label>
        <div
          ref={filterRegionRef}
          onBlur={(event) => {
            if (event.relatedTarget instanceof Node && !event.currentTarget.contains(event.relatedTarget))
              setOpen(false);
          }}
        >
          <Button
            ref={triggerRef}
            type="button"
            variant="outline"
            size="sm"
            aria-label={activeCount ? `Filters, ${activeCount} active` : "Filters"}
            aria-expanded={open}
            aria-controls={open ? panelId : undefined}
            aria-haspopup="dialog"
            className={cn(
              "h-10 gap-2 rounded-xl bg-background/80 px-3",
              (open || activeCount > 0) && "border-primary/50",
            )}
            onClick={() => {
              onBrowse();
              setOpen(!open);
            }}
          >
            <SlidersHorizontal aria-hidden="true" className="h-4 w-4 text-primary" />
            Filters
            {activeCount ? (
              <span className="rounded-full bg-primary/15 px-1.5 text-xs text-primary">{activeCount}</span>
            ) : null}
          </Button>
          {open ? (
            <div id={panelId} role="dialog" aria-label="Inventory filters" className="armory-filter-panel">
              <div className="mb-3 flex shrink-0 items-center justify-between border-b border-border/50 pb-2">
                <h3 className="text-base font-semibold text-primary">Inventory filters</h3>
                <Button
                  data-filter-close
                  type="button"
                  variant="ghost"
                  size="sm"
                  aria-label="Close inventory filters"
                  className="h-8 w-8 p-0"
                  onClick={close}
                >
                  <X aria-hidden="true" className="h-4 w-4" />
                </Button>
              </div>
              {!isTrinket ? (
                <FilterGroup title="Rarity">
                  <div className="flex flex-wrap gap-2">
                    {RARITIES.map(({ id, label }) => (
                      <button
                        key={id}
                        type="button"
                        aria-pressed={filters.rarities.includes(id)}
                        className={cn(
                          "focus-visible:ring-ring rounded-lg border px-3 py-1.5 text-sm outline-none focus-visible:ring-2",
                          filters.rarities.includes(id)
                            ? "border-primary/60 bg-primary/10 text-primary"
                            : "border-border/70 hover:bg-muted/60",
                        )}
                        onClick={() => onFiltersChange({ ...filters, rarities: toggleValue(filters.rarities, id) })}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </FilterGroup>
              ) : null}
              <FilterGroup title="Equipment">
                <div className="grid gap-1">
                  {(
                    [
                      { id: null, label: "All items" },
                      { id: "unequipped", label: "Unequipped" },
                      { id: "equipped", label: "Equipped by another hero" },
                    ] as const
                  ).map(({ id, label }) => (
                    <label
                      key={id ?? "all"}
                      className="flex min-h-8 cursor-pointer items-center gap-2 rounded-lg px-2 text-sm hover:bg-muted/60"
                    >
                      <input
                        type="radio"
                        name={`${panelId}-equipment`}
                        checked={filters.equipment === id}
                        onChange={() => onFiltersChange({ ...filters, equipment: id })}
                        className="h-4 w-4 accent-primary"
                      />
                      {label}
                    </label>
                  ))}
                </div>
              </FilterGroup>
              <KeywordFilters filters={filters} isTrinket={isTrinket} onChange={onFiltersChange} />
              <div className="mt-3 flex shrink-0 justify-between border-t border-border/50 pt-3">
                <span className="self-center text-xs text-muted-foreground">
                  {matchCount} of {totalCount} items
                </span>
                <Button type="button" variant="ghost" size="sm" disabled={!hasCriteria} onClick={reset}>
                  Clear all
                </Button>
              </div>
            </div>
          ) : null}
        </div>
        <Select {...selectDismiss} value="" onValueChange={(value) => onSort(value as ArmorySortOption)}>
          <SelectTrigger
            aria-label="Sort inventory"
            className="h-10 w-auto gap-2 rounded-xl border-border/80 bg-background/80 px-3 py-1 text-sm"
          >
            <ArrowDownAZ aria-hidden="true" className="h-4 w-4 text-primary" />
            <span className="font-medium">Sort</span>
          </SelectTrigger>
          <SelectContent side="top" align="end">
            {!isTrinket ? <SelectItem value="rarity">Rarity: Unique → Astral → Basic</SelectItem> : null}
            <SelectItem value="name">Name: A–Z</SelectItem>
            <SelectItem value="name-desc">Name: Z–A</SelectItem>
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}

function KeywordFilters({
  filters,
  isTrinket,
  onChange,
}: {
  filters: ArmoryInventoryFilters;
  isTrinket: boolean;
  onChange: (filters: ArmoryInventoryFilters) => void;
}) {
  const [query, setQuery] = useState("");
  const keywords = ARMORY_FILTER_KEYWORDS.filter((entry) =>
    entry.label.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()),
  );
  return (
    <div
      role="group"
      aria-label={isTrinket ? "Effect Keywords" : "Affix Keywords"}
      className="flex min-h-0 flex-1 flex-col"
    >
      <h4 className="mb-2 shrink-0 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
        {isTrinket ? "Effect Keywords" : "Affix Keywords"}
      </h4>
      <div className="mb-2 flex shrink-0 items-center justify-between gap-2 text-xs">
        <span className="text-muted-foreground">Match selected keywords</span>
        <div className="flex gap-1" role="group" aria-label="Keyword matching">
          {(["any", "all"] as const).map((mode) => (
            <button
              key={mode}
              type="button"
              aria-pressed={filters.keywordMatch === mode}
              className={cn(
                "focus-visible:ring-ring rounded-md px-2 py-1 outline-none focus-visible:ring-2",
                filters.keywordMatch === mode ? "bg-primary/15 text-primary" : "hover:bg-muted/60",
              )}
              onClick={() => onChange({ ...filters, keywordMatch: mode })}
            >
              {mode === "any" ? "Any" : "All"}
            </button>
          ))}
        </div>
      </div>
      <input
        type="search"
        aria-label="Find a keyword"
        placeholder="Find a keyword…"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        className="mb-2 h-8 w-full shrink-0 rounded-lg border border-border/80 bg-background/80 px-2 text-sm outline-none focus:border-primary"
      />
      <div className="grid max-h-[calc(9*var(--content-rem,1rem))] min-h-0 flex-1 grid-cols-2 gap-1 overflow-y-auto">
        {keywords.map(({ id, label }) => (
          <label
            key={id}
            className="flex min-h-8 cursor-pointer items-center gap-2 rounded-lg px-2 text-sm hover:bg-muted/60"
          >
            <input
              type="checkbox"
              checked={filters.keywords.includes(id)}
              onChange={() => onChange({ ...filters, keywords: toggleValue(filters.keywords, id) })}
              className="h-4 w-4 shrink-0 accent-primary"
            />
            {label}
          </label>
        ))}
        {keywords.length === 0 ? (
          <p className="col-span-2 py-2 text-sm text-muted-foreground">No keywords found.</p>
        ) : null}
      </div>
    </div>
  );
}

function FilterGroup({ title, children }: { title: string; children: ReactNode }) {
  return (
    <fieldset className="mb-3 shrink-0">
      <legend className="mb-2 text-xs font-semibold tracking-wide text-muted-foreground uppercase">{title}</legend>
      {children}
    </fieldset>
  );
}

function CriteriaChip({ label, onRemove }: { label: string; onRemove: () => void }) {
  return (
    <button
      type="button"
      aria-label={`Remove ${label} filter`}
      onClick={onRemove}
      className="focus-visible:ring-ring flex shrink-0 items-center gap-1 rounded-full border border-primary/20 bg-primary/5 px-2 py-1 text-xs text-foreground outline-none hover:bg-primary/15 focus-visible:ring-2"
    >
      <span className="max-w-[12rem] truncate">{label}</span>
      <X aria-hidden="true" className="h-3 w-3" />
    </button>
  );
}
