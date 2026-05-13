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
