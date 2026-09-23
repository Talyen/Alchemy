import { tryLocalStorageGetItem } from "@/lib/storage-environment";

export function isAlchemyDevBuild(): boolean {
  return import.meta.env.DEV;
}

export function shouldSkipStartupLoadingGate(): boolean {
  const result = tryLocalStorageGetItem("alchemy-skip-loading-screen");
  return result.ok && result.value === "true";
}
