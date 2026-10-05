import type { Immutable } from "immer";
import type { GameplayState } from "./gameplay-state-store";

export type RunTransaction = Immutable<GameplayState>;
