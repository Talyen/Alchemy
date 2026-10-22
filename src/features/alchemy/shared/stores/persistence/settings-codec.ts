import { createDefaultSettingsSaveFields, type SettingsSaveFields } from "@/lib/validation";
import {
  clampBrightnessPct,
  clampSpecialEffectsPct,
  clampVolumePct,
  resolveAutoplayEnabled,
} from "@/lib/settings-values";
import type { createSettingsStore } from "../session/settings-state";

// Defaults own the persisted field list; methods and unrelated save fields never encode.
const SETTINGS_SAVE_KEYS = Object.keys(createDefaultSettingsSaveFields()) as Array<keyof SettingsSaveFields>;

export function selectSettingsSaveFields(state: SettingsSaveFields): SettingsSaveFields {
  const selected = createDefaultSettingsSaveFields();
  for (const key of SETTINGS_SAVE_KEYS) Object.assign(selected, { [key]: state[key] });
  return selected;
}

export function createSettingsPersistenceCodec(store: ReturnType<typeof createSettingsStore>) {
  function prepareHydration(fields: SettingsSaveFields) {
    const selected = selectSettingsSaveFields(fields);
    const normalized = {
      ...selected,
      brightness: clampBrightnessPct(selected.brightness),
      backgroundParticlesIntensity: clampSpecialEffectsPct(selected.backgroundParticlesIntensity),
      backgroundGlowIntensity: clampSpecialEffectsPct(selected.backgroundGlowIntensity),
      musicVolume: clampVolumePct(selected.musicVolume),
      sfxVolume: clampVolumePct(selected.sfxVolume),
      masterVolume: clampVolumePct(selected.masterVolume),
      // Loading with remember off clears a stored autoplay choice.
      autoplayEnabled: resolveAutoplayEnabled(selected),
    };
    return (prepareObservers: () => void = () => {}) => store.commitHydration(normalized, prepareObservers);
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
