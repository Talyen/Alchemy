export function isAlchemyDevBuild(): boolean {
  return import.meta.env.DEV;
}

export function shouldSkipStartupLoadingGate(): boolean {
  if (typeof localStorage === "undefined") return false;
  return localStorage.getItem("alchemy-skip-loading-screen") === "true";
}
