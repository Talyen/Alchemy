// Shared typography role classes for screen chrome, body copy, and tooltips.
// Keep sizes consistent across screens; bump roles here instead of per-screen one-offs.

/** Screen title (ScreenHeader). */
export const screenTitleClass = "text-2xl font-black tracking-[0.15em] text-amber-100/75 uppercase sm:text-3xl";

/** Screen supporting description (ScreenDescription). */
export const screenDescriptionClass = "text-lg leading-relaxed";

/** Section / mode / panel subheaders. */
export const sectionTitleClass = "text-xl font-bold text-amber-100/75";

/** Body / narrative copy. */
export const bodyTextClass = "text-lg leading-relaxed text-muted-foreground";

/** Settings / options control labels (slider, toggle, select). */
export const controlLabelClass = "text-lg font-semibold text-foreground";

/** Settings / options helper copy under a control label. */
export const controlDescriptionClass = "mt-1 text-lg text-muted-foreground";

/** Tooltip title. */
export const tooltipHeaderClass = "mb-1 font-sans text-base font-bold text-foreground sm:text-lg";

/** Tooltip uppercase label / keyword line. */
export const tooltipSubheaderClass = "mt-2.5 mb-1 text-xs font-semibold tracking-widest text-amber-100/80 uppercase";

/** Tooltip body copy. */
export const tooltipBodyClass = "mt-1 space-y-1 text-sm leading-relaxed text-muted-foreground";
