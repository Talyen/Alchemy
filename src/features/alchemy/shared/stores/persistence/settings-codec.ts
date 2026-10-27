import { SETTINGS_SAVE_KEYS, createDefaultSettingsSaveFields, type SettingsSaveFields } from "@/lib/validation";
import { settingsNumberNormalizers, resolveAutoplayEnabled } from "@/lib/settings-values";
import type { createSettingsStore } from "../session/settings-state";

export function selectSettingsSaveFields(state: SettingsSaveFields): SettingsSaveFields {
  return Object.fromEntries(SETTINGS_SAVE_KEYS.map((key) => [key, state[key]])) as SettingsSaveFields;
}

export function createSettingsPersistenceCodec(store: ReturnType<typeof createSettingsStore>) {
  function prepareHydration(fields: SettingsSaveFields) {
    const selected = selectSettingsSaveFields(fields);
    for (const key of Object.keys(settingsNumberNormalizers) as Array<keyof typeof settingsNumberNormalizers>) {
      selected[key] = settingsNumberNormalizers[key](selected[key]);
    }
    // Loading with remember off clears a stored autoplay choice.
    selected.autoplayEnabled = resolveAutoplayEnabled(selected);
    return (prepareObservers: () => void = () => {}) => store.commitHydration(selected, prepareObservers);
  }
  return {
    createDefault: createDefaultSettingsSaveFields,
    // Pure selection: the live invariant is owned by the setters above (which
    // clamp on every write), load repair by SaveDataSchema, and direct-hydrate
    // safety by prepareHydration. Encode adds no further derivation.
    encode: () => selectSettingsSaveFields(store.getState()),
    prepareHydration,
    hydrate: (fields: SettingsSaveFields) => prepareHydration(fields)(),
  };
}
