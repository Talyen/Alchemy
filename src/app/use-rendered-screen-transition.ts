// Lagged screen rendering for page exit/enter animations and tooltip blocking.
import { useEffect, useRef, useState } from "react";
import type { Screen } from "@/features/alchemy/types";
import { PAGE_EXIT_MS } from "@/lib/game-constants";

export function useRenderedScreenTransition(controllerScreen: Screen, commitPendingTransition: () => void) {
  const [renderedScreen, setRenderedScreen] = useState<Screen>("menu");
  const [pagePhase, setPagePhase] = useState<"enter" | "exit">("enter");
  const [tooltipBlocked, setTooltipBlocked] = useState(true);
  const pendingScreenRef = useRef(renderedScreen);

  useEffect(() => {
    if (controllerScreen === renderedScreen) return;
    pendingScreenRef.current = controllerScreen;
    setPagePhase("exit"); // eslint-disable-line react-hooks/set-state-in-effect
    const timeout = window.setTimeout(() => {
      commitPendingTransition();
      setRenderedScreen(pendingScreenRef.current);
      setPagePhase("enter");
    }, PAGE_EXIT_MS);
    return () => window.clearTimeout(timeout);
  }, [controllerScreen, renderedScreen, commitPendingTransition]);

  useEffect(() => {
    setTooltipBlocked(true); // eslint-disable-line react-hooks/set-state-in-effect
    const timer = window.setTimeout(() => setTooltipBlocked(false), 400);
    return () => window.clearTimeout(timer);
  }, [renderedScreen]);

  return { renderedScreen, pagePhase, tooltipBlocked };
}
