import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { localization, createTranslationReader } from "@/lib/localization/runtime";

/** Keep compiler caches dependent on react-i18next's current bound function. */
export function useGameTranslation() {
  const { t } = useTranslation(undefined, { i18n: localization, useSuspense: false });
  return useMemo(() => createTranslationReader(t), [t]);
}
