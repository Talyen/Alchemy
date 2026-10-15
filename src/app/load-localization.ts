import { installCatalogs } from "@/lib/localization/runtime";

export async function loadBundledCatalogs(): Promise<void> {
  // Vite emits this as a local asset, keeping catalogs outside the JS budget.
  // Both the web distribution and the packaged app include the same file.
  const response = await fetch(new URL("../lib/localization/locales/runtime.json", import.meta.url));
  if (!response.ok) throw new Error("Bundled localization catalogs could not be loaded");
  installCatalogs(await response.json());
}
