import { motion } from 'framer-motion'
import type { ReactNode } from 'react'
import { useState } from 'react'
import { SelectionScreenShell } from './SelectionScreenShell'

export type OptionsTab = 'display' | 'audio' | 'general'
export type ResolutionPreset = 'auto' | '1280x720' | '1600x900' | '1920x1080' | '2560x1440'

export type GameSettings = {
  display: {
    resolutionPreset: ResolutionPreset
  }
  audio: {
    master: number
    music: number
    sfx: number
  }
}

type Props = {
  settings: GameSettings
  activeTab: OptionsTab
  onChangeTab: (tab: OptionsTab) => void
  onSetResolutionPreset: (preset: ResolutionPreset) => void
  onSetAudio: (channel: 'master' | 'music' | 'sfx', value: number) => void
  onResetAudioDefaults: () => void
  onClearSavedProgress: () => void
  onBack: () => void
  topLeft?: ReactNode
}

const RESOLUTION_OPTIONS: Array<{ value: ResolutionPreset; label: string; detail: string }> = [
  { value: 'auto', label: 'Auto', detail: 'Fit the current browser window.' },
  { value: '1280x720', label: '1280 x 720', detail: 'Smaller layout target.' },
  { value: '1600x900', label: '1600 x 900', detail: 'Balanced default target.' },
  { value: '1920x1080', label: '1920 x 1080', detail: 'Full HD target.' },
  { value: '2560x1440', label: '2560 x 1440', detail: 'QHD target.' },
]

export function OptionsScreen({
  settings,
  activeTab,
  onChangeTab,
  onSetResolutionPreset,
  onSetAudio,
  onResetAudioDefaults,
  onClearSavedProgress,
  onBack,
  topLeft,
}: Props) {
  const [confirmingClear, setConfirmingClear] = useState(false)

  return (
    <SelectionScreenShell title="Options" subtitle="Settings" topLeft={topLeft} layout="top" titleOffsetY={8}>
      <div className="w-full h-full min-h-0 max-w-5xl px-8 pb-6 flex flex-col gap-4">
        <div className="flex items-center justify-between gap-3">
          <div className="flex flex-wrap gap-2">
            {(['display', 'audio', 'general'] as const).map(tab => {
              const isActive = activeTab === tab
              return (
                <motion.button
                  key={tab}
                  type="button"
                  onClick={() => onChangeTab(tab)}
                  className={`rounded-lg border px-4 py-2 text-xs uppercase tracking-wider ${isActive ? 'border-zinc-500 bg-zinc-800/90 text-zinc-100' : 'border-zinc-700/80 bg-zinc-900/70 text-zinc-400'}`}
                  whileHover={{ scale: 1.03 }}
                  whileTap={{ scale: 0.97 }}
                >
                  {tab}
                </motion.button>
              )
            })}
          </div>

          <motion.button
            type="button"
            onClick={onBack}
            className="rounded-lg border border-zinc-700/80 bg-zinc-900/85 px-3 py-2 text-xs text-zinc-200"
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.97 }}
          >
            Back
          </motion.button>
        </div>

        <div className="rounded-2xl border border-zinc-800/70 bg-zinc-950/70 p-5">
          {activeTab === 'display' && (
            <div className="space-y-3">
              <p className="text-sm text-zinc-200">Resolution Preset</p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {RESOLUTION_OPTIONS.map(option => {
                  const selected = option.value === settings.display.resolutionPreset
                  return (
                    <motion.button
                      key={option.value}
                      type="button"
                      onClick={() => onSetResolutionPreset(option.value)}
                      className={`rounded-lg border p-3 text-left ${selected ? 'border-zinc-500 bg-zinc-800/90' : 'border-zinc-800/80 bg-zinc-900/55'}`}
                      whileHover={{ scale: 1.01 }}
                      whileTap={{ scale: 0.99 }}
                    >
                      <p className={`text-sm ${selected ? 'text-zinc-100' : 'text-zinc-300'}`}>{option.label}</p>
                      <p className="mt-1 text-xs text-zinc-500">{option.detail}</p>
                    </motion.button>
                  )
                })}
              </div>
            </div>
          )}

          {activeTab === 'audio' && (
            <div className="space-y-4">
              {([
                ['master', 'Master Volume', settings.audio.master],
                ['music', 'Music Volume', settings.audio.music],
                ['sfx', 'SFX Volume', settings.audio.sfx],
              ] as const).map(([id, label, value]) => (
                <label key={id} className="block">
                  <div className="mb-1 flex items-center justify-between text-sm text-zinc-200">
                    <span>{label}</span>
                    <span className="text-zinc-400">{value}%</span>
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={100}
                    step={1}
                    value={value}
                    onChange={(event) => onSetAudio(id, Number(event.target.value))}
                    className="w-full accent-zinc-300"
                  />
                </label>
              ))}

              <motion.button
                type="button"
                onClick={onResetAudioDefaults}
                className="rounded-lg border border-zinc-700/80 bg-zinc-900/70 px-3 py-2 text-xs text-zinc-200"
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
              >
                Reset To Default
              </motion.button>
            </div>
          )}

          {activeTab === 'general' && (
            <div className="space-y-4">
              <div className="rounded-lg border border-red-900/60 bg-red-950/35 px-3 py-3">
                <p className="text-sm text-red-200">Clear Saved Progress</p>
                <p className="mt-1 text-xs text-red-300/80">
                  This permanently deletes run saves, encounter history, talents, and settings from local storage.
                </p>

                {!confirmingClear ? (
                  <motion.button
                    type="button"
                    onClick={() => setConfirmingClear(true)}
                    className="mt-3 rounded-lg border border-red-700/80 bg-red-950/60 px-3 py-2 text-xs text-red-100"
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                  >
                    Clear Saved Progress
                  </motion.button>
                ) : (
                  <div className="mt-3 rounded-lg border border-zinc-700/80 bg-zinc-950/70 p-3">
                    <p className="text-xs text-zinc-300">Are you sure? This cannot be undone.</p>
                    <div className="mt-2 flex items-center gap-2">
                      <motion.button
                        type="button"
                        onClick={() => {
                          onClearSavedProgress()
                          setConfirmingClear(false)
                        }}
                        className="rounded-lg border border-red-700/80 bg-red-950/70 px-3 py-1.5 text-xs text-red-100"
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                      >
                        Yes, Clear Everything
                      </motion.button>
                      <motion.button
                        type="button"
                        onClick={() => setConfirmingClear(false)}
                        className="rounded-lg border border-zinc-700/80 bg-zinc-900/80 px-3 py-1.5 text-xs text-zinc-200"
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                      >
                        Cancel
                      </motion.button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </SelectionScreenShell>
  )
}
