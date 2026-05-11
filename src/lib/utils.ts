// Shared class-name combiner for Tailwind and conditional classes.
// Depends on clsx and tailwind-merge.
// Used throughout UI components to avoid conflicting utility classes.
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
