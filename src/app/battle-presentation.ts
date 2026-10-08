import { defaultGameSession } from "./application-session";
import { createBattlePresentationStore } from "@/features/alchemy/run-loop/battle/battle-presentation-store";

/** The application composes its battle presentation alongside its gameplay session. */
export const battlePresentation = createBattlePresentationStore(defaultGameSession);
