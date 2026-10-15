import { useTranslation } from "react-i18next";
import { localization } from "@/lib/localization/runtime";

export function useGameTranslation(): void {
  useTranslation(undefined, { i18n: localization, useSuspense: false });
}
