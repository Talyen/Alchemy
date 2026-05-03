import { useCallback, useEffect } from 'react';

import {
  initAudio,
  playSound,
  playVictory,
  playDefeat,
  playTurnStart,
  setMasterVolume,
  setMuted,
  getMuted,
  setSound,
  getSound,
  getAllSoundOptions,
  type SoundCategory,
  type SoundVariant,
} from '@/lib/audio';

export function useSound() {
  useEffect(() => {
    initAudio();
  }, []);

  const click = useCallback(() => playSound('ui'), []);
  const cardHover = useCallback(() => playSound('ui'), []);
  const damage = useCallback(() => playSound('damage'), []);
  const buff = useCallback(() => playSound('beneficial'), []);
  const victory = useCallback(() => playVictory(), []);
  const defeat = useCallback(() => playDefeat(), []);
  const turnStart = useCallback(() => playTurnStart(), []);

  const setVolume = useCallback((value: number) => {
    setMasterVolume(value);
  }, []);

  const mute = useCallback((muted: boolean) => {
    setMuted(muted);
  }, []);

  const isMuted = useCallback(() => getMuted(), []);

  const setDamage = useCallback((variant: SoundVariant) => {
    setSound('damage', variant);
  }, []);

  const setBuff = useCallback((variant: SoundVariant) => {
    setSound('beneficial', variant);
  }, []);

  const setUI = useCallback((variant: SoundVariant) => {
    setSound('ui', variant);
  }, []);

  const setCategory = useCallback((category: SoundCategory, variant: SoundVariant) => {
    setSound(category, variant);
  }, []);

  const getCategory = useCallback((category: SoundCategory): SoundVariant => {
    return getSound(category);
  }, []);

  return {
    click,
    cardHover,
    damage,
    buff,
    victory,
    defeat,
    turnStart,
    setVolume,
    mute,
    isMuted,
    setDamage,
    setBuff,
    setUI,
    setCategory,
    getCategory,
    damageOptions: getAllSoundOptions().damage,
    buffOptions: getAllSoundOptions().beneficial,
    uiOptions: getAllSoundOptions().ui,
    allSoundOptions: getAllSoundOptions(),
  };
}