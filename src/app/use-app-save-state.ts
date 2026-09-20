import { useLatestRef } from "@/features/alchemy/shared/ui/use-latest-ref";
import { useEffect } from "react";
import { createAlchemyAutosaveLifecycle } from "./autosave-lifecycle";

export function useAlchemyAutosaveFromStores(enabled = true) {
  const enabledRef = useLatestRef(enabled);
  useEffect(() => {
    const lifecycle = createAlchemyAutosaveLifecycle(() => enabledRef.current);
    const handlePageExit = () => lifecycle.flush(true);
    const handleVisibilityChange = () => {
      if (document.visibilityState === "hidden") lifecycle.flush(true);
    };
    window.addEventListener("pagehide", handlePageExit);
    window.addEventListener("beforeunload", handlePageExit);
    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      window.removeEventListener("pagehide", handlePageExit);
      window.removeEventListener("beforeunload", handlePageExit);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      lifecycle.dispose();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- latest enabled value prevents outgoing lifetime writes
  }, [enabled]);
}
