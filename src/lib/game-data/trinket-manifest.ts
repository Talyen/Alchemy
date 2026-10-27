import { trinketDefinitions } from "./compendium/trinket-definitions";

type AuthoredEffects = (typeof trinketDefinitions)[number]["effects"];
type KeysOfUnion<T> = T extends unknown ? keyof T : never;
type ValueAt<T, K> = T extends unknown ? (K extends keyof T ? T[K] : never) : never;

export type TrinketManifest = {
  [K in KeysOfUnion<AuthoredEffects>]: ValueAt<AuthoredEffects, K> extends boolean ? boolean : number;
};

// The catalog owns both the available mechanics and their neutral values.
export const defaultTrinketEffects: Readonly<TrinketManifest> = Object.freeze(
  Object.fromEntries(
    trinketDefinitions.flatMap(({ effects }) =>
      Object.entries(effects).map(([key, value]) => [key, typeof value === "boolean" ? false : 0]),
    ),
  ) as TrinketManifest,
);
