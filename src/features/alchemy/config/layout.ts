// Shared card sizing and surface classes for battle, collection, and popup card UI.

// These clamp() CSS values size cards from the virtual stage rather than the
// browser viewport so preview emulation and desktop scaling stay consistent.
export const battleCardWidthClass = "w-[clamp(222px,22cqh,336px)]";
export const handCardWidthClass = "w-[clamp(189px,18.7cqh,286px)]";
export const collectionCardWidthClass = "w-[clamp(156px,15vw,210px)]";
export const pileCardWidthClass = "w-[clamp(144px,14.4cqh,219px)]";

// Mobile landscape uses the same virtual-stage battle composition as desktop.
export const mobileStageBattleCardWidthClass = "w-[clamp(270px,33cqh,330px)]";
export const mobileStageHandCardWidthClass = "w-[clamp(200px,24cqh,250px)]";

// Card and popup surfaces stay centralized so repeated game widgets share the
// same tactile fantasy material treatment.
export const cardSurfaceClass = "relative overflow-hidden rounded-[30px] bg-black";
export const staticCardTransform = "translate3d(0px, 0px, 0px)";
export const popupClassName = "absolute bottom-full left-1/2 z-40 mb-4 w-60 -translate-x-1/2 rounded-[20px] border border-border/80 bg-card px-3 py-3 text-left";

export const battleActorHalfGapClass = {
  desktop: "clamp(168px,10cqw,210px)",
  mobile: "clamp(130px,8cqw,180px)",
  ultrawide: "clamp(168px,10cqw,300px)",
} as const;

export const battleActorSectionClass = {
  desktop: "absolute inset-x-0 flex -translate-y-1/2 items-start justify-center px-4 gap-[clamp(336px,20cqw,420px)]",
  mobile: "absolute inset-x-0 flex -translate-y-1/2 items-start justify-center px-4 gap-[clamp(260px,16cqw,360px)]",
  ultrawide: "absolute inset-x-0 flex -translate-y-1/2 items-start justify-center px-4 gap-[clamp(336px,20cqw,600px)]",
} as const;

export const battleBottomBarClass = {
  desktop: "absolute inset-x-0 grid items-end gap-[clamp(16px,2vw,28px)] px-2 bottom-2 grid-cols-[minmax(110px,0.24fr)_1fr_minmax(110px,0.24fr)] pb-1",
  mobile: "absolute inset-x-0 grid items-end gap-[clamp(16px,2vw,28px)] px-2 bottom-[calc(70px+env(safe-area-inset-bottom))] grid-cols-[minmax(170px,0.18fr)_1fr_minmax(220px,0.18fr)] pb-0",
} as const;

export const battleBottomColumnClass = {
  desktop: "flex flex-col items-center justify-end gap-4 pb-4",
  mobile: "flex flex-col items-center justify-end gap-3 pb-8",
} as const;

export const battleHandContainerClass = {
  desktop: "flex min-w-0 items-end justify-center min-h-[334px] pb-3 pt-10",
  mobile: "flex min-w-0 items-end justify-center min-h-[320px] pb-0 pt-12",
} as const;
