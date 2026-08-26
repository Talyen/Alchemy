// Shared typography role classes for screen chrome, body copy, and tooltips.
// Keep sizes consistent across screens; bump roles here instead of per-screen one-offs.
// `text-balance` belongs on short, width-constrained prose (titles, tooltip headers, blurbs).
// Repeated tooltip list lines use `tooltipBodyLineClass` (`text-pretty`) instead — balance
// only runs when text wraps, so per-line balance in a list looks uneven next to one-liners.
// Chips, nowrap titles, and long documents skip both.

/** Screen title (ScreenHeader). */
export const screenTitleClass =
  "text-2xl font-black tracking-[0.15em] text-amber-100/75 uppercase text-balance sm:text-3xl";

/** Screen supporting description (ScreenDescription). */
export const screenDescriptionClass = "text-lg leading-relaxed text-balance";

/** Section / mode / panel subheaders. */
export const sectionTitleClass = "text-xl font-bold text-amber-100/75 text-balance";

/** Body / narrative copy. */
export const bodyTextClass = "text-lg leading-relaxed text-muted-foreground text-balance";

/** Settings / options control labels (slider, toggle, select). */
export const controlLabelClass = "text-lg font-semibold text-foreground";

/** Settings / options helper copy under a control label. */
export const controlDescriptionClass = "mt-1 text-lg text-muted-foreground text-balance";

/** Tooltip title. */
export const tooltipHeaderClass = "mb-1 font-sans text-sm font-bold text-foreground text-balance sm:text-base";

/** Tooltip uppercase label / keyword line. */
export const tooltipSubheaderClass =
  "mt-2.5 mb-1 text-xs font-semibold tracking-widest text-amber-100/80 uppercase text-balance";

/** Tooltip body container / paragraph copy. */
export const tooltipBodyClass = "mt-1 space-y-1 text-sm leading-relaxed text-muted-foreground text-balance";

/** Single line inside a tooltip list (card rules, gear affixes, enemy traits). */
export const tooltipBodyLineClass = "text-sm leading-relaxed text-muted-foreground text-pretty";

/** Compact pill text inside a tooltip (materials, gold, status values). */
export const tooltipChipClass = "text-xs font-semibold";

/** Run-scope footer pill on trinket tooltips. Smaller than status/material chips. */
export const tooltipFooterChipClass = "text-[0.625rem] font-semibold";

/** Lucide / material icon size inside a tooltip chip. */
export const tooltipChipIconClass = "h-3.5 w-3.5";
