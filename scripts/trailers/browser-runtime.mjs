/** Runs only inside the isolated recording page; production code stays untouched. */
export function installCaptureRuntime() {
  const { window } = globalThis;
  const state = {
    start: null,
    sounds: [],
    animations: new Map(),
    videos: new Map(),
    initialized: false,
    music: null,
    videoFrameRates: {},
  };
  const NativeAudio = window.Audio;
  window.Audio = class extends NativeAudio {
    capturePosition = 0;
    captureAt = globalThis.performance.now();
    capturePaused = true;
    get paused() {
      return this.capturePaused;
    }
    get currentTime() {
      if (this.capturePaused) return this.capturePosition;
      const now = globalThis.performance.now();
      if (state.music && state.start !== null && new URL(this.src).pathname === state.music.src)
        return state.music.offset + (now - state.start) / 1000;
      return this.capturePosition + (now - this.captureAt) / 1000;
    }
    set currentTime(position) {
      this.capturePosition = position;
      this.captureAt = globalThis.performance.now();
    }
    play() {
      this.capturePosition = this.currentTime;
      this.captureAt = globalThis.performance.now();
      this.capturePaused = false;
      if (this.src.includes("/sounds/") && state.start !== null) {
        const event = {
          src: new URL(this.src).pathname,
          at: (globalThis.performance.now() - state.start) / 1000,
          end: null,
          volume: this.muted ? 0 : this.volume,
          offset: this.currentTime,
        };
        state.sounds.push(event);
        this.captureEvent = event;
      }
      return Promise.resolve();
    }
    pause() {
      if (this.captureEvent && this.captureEvent.end === null && state.start !== null)
        this.captureEvent.end = (globalThis.performance.now() - state.start) / 1000;
      this.capturePosition = this.currentTime;
      this.capturePaused = true;
      this.captureEvent = null;
      super.pause();
    }
  };
  window.__trailerCapture = state;
  if (globalThis.Element && globalThis.Animation) {
    const animate = globalThis.Element.prototype.animate;
    const startTime = Object.getOwnPropertyDescriptor(globalThis.Animation.prototype, "startTime");
    globalThis.Element.prototype.animate = function (...args) {
      const animation = animate.apply(this, args);
      if (state.start !== null) {
        animation.pause();
        animation.currentTime = 0;
        state.animations.set(animation, { at: globalThis.performance.now() - state.start, base: 0 });
      }
      return animation;
    };
    if (startTime?.set)
      Object.defineProperty(globalThis.Animation.prototype, "startTime", {
        ...startTime,
        set(value) {
          if (state.start !== null && value !== null) {
            // Motion assigns performance.now() as WAAPI's startTime. With a
            // paused JS clock that belongs to a different timeline than the
            // browser compositor, which can finish opacity before sampling.
            state.animations.set(this, { at: Number(value) - state.start, base: 0 });
            this.pause();
            this.currentTime = 0;
          } else startTime.set.call(this, value);
        },
      });
  }
  if (globalThis.HTMLVideoElement) {
    const prototype = globalThis.HTMLVideoElement.prototype;
    const play = prototype.play;
    const pause = prototype.pause;
    state.pauseVideo = (video) => pause.call(video);
    state.videoEntry = (video, time) => {
      let entry = state.videos.get(video);
      if (!entry || entry.src !== video.src) {
        entry = { src: video.src, at: time, base: video.currentTime, playing: !video.paused, ended: false };
        state.videos.set(video, entry);
      }
      return entry;
    };
    const elapsed = () => (state.start === null ? 0 : globalThis.performance.now() - state.start);
    prototype.play = function () {
      const entry = state.videoEntry(this, elapsed());
      Object.assign(entry, { at: elapsed(), base: this.currentTime, playing: true, ended: false });
      entry.ready = play.call(this).then(() => {
        if (state.start !== null) pause.call(this);
      });
      return entry.ready;
    };
    prototype.pause = function () {
      const entry = state.videoEntry(this, elapsed());
      Object.assign(entry, { at: elapsed(), base: this.currentTime, playing: false });
      pause.call(this);
    };
  }
}

/** Clock controls JS timers/rAF; this samples CSS/WAAPI and video on the same timeline. */
export async function sampleVisualTime(timeMs) {
  const { window, document } = globalThis;
  const state = window.__trailerCapture;
  if (Math.abs(globalThis.performance.now() - state.start - timeMs) > 1)
    throw new Error("Gameplay clock diverged from frame sampling");
  const live = new Set(document.getAnimations());
  for (const animation of state.animations.keys()) if (!live.has(animation)) state.animations.delete(animation);
  for (const animation of live) {
    if (!state.animations.has(animation))
      state.animations.set(animation, { at: timeMs, base: state.initialized ? 0 : Number(animation.currentTime ?? 0) });
    const entry = state.animations.get(animation);
    if (entry.done) continue;
    animation.pause();
    animation.currentTime = entry.base + timeMs - entry.at;
    const end = animation.effect?.getComputedTiming().endTime;
    if (Number.isFinite(end) && Number(animation.currentTime) >= end && animation.playbackRate !== 0) {
      animation.finish();
      entry.done = true;
    }
  }
  const videos = [...document.querySelectorAll("video")];
  await Promise.all(
    videos.map(async (video) => {
      if (video.error) throw new Error("Video playback failed during capture");
      if (!Number.isFinite(video.duration) || video.duration <= 0)
        await new Promise((resolve, reject) => {
          const ready = () => {
            video.removeEventListener("error", failed);
            resolve();
          };
          const failed = () => {
            video.removeEventListener("loadedmetadata", ready);
            reject(new Error("Video metadata failed during capture"));
          };
          video.addEventListener("loadedmetadata", ready, { once: true });
          video.addEventListener("error", failed, { once: true });
        });
      const entry = state.videoEntry(video, timeMs);
      if (!state.initialized) Object.assign(entry, { at: timeMs, base: video.currentTime });
      // Let a newly started buffer emit playing before pausing its native clock.
      // Otherwise a fast recording loop can cancel the handoff itself.
      if (entry.playing) await entry.ready;
      state.pauseVideo(video);
      // Paused buffers can be rewound by the game without changing their URL.
      const elapsed = entry.playing
        ? entry.base + ((timeMs - entry.at) / 1000) * video.playbackRate
        : video.currentTime;
      const ended = entry.playing && !video.loop && elapsed >= video.duration && !entry.ended;
      let position = video.loop ? elapsed % video.duration : Math.min(elapsed, Math.max(0, video.duration - 0.00001));
      const fps = state.videoFrameRates?.[new URL(video.src, globalThis.location?.href ?? "http://localhost").pathname];
      // Both the sample and clip-start clocks round to integer milliseconds;
      // their difference can be almost 1 ms short of a native frame boundary.
      // Absorb that error, then seek to the center of the chosen frame.
      if (fps) position = Math.min(video.duration - 0.00001, (Math.floor((position + 0.0010001) * fps) + 0.5) / fps);
      if (Math.abs(video.currentTime - position) >= 0.0001)
        await new Promise((resolve, reject) => {
          let seeked = false;
          let frameRequest = null;
          let presented = true;
          const cleanup = () => {
            video.removeEventListener("seeked", decoded);
            video.removeEventListener("error", failed);
            if (frameRequest !== null) video.cancelVideoFrameCallback(frameRequest);
          };
          const done = () => {
            if (seeked && presented) {
              cleanup();
              resolve();
            }
          };
          const decoded = () => {
            seeked = true;
            done();
          };
          const failed = () => {
            cleanup();
            reject(new Error("Video seek failed"));
          };
          // Decoding can finish before the compositor replaces a video layer.
          // Hidden preloads and buffers covered by an opaque incoming video do
          // not submit visible frames, so only wait for contributing layers.
          if (typeof video.requestVideoFrameCallback === "function") {
            const style = globalThis.getComputedStyle(video);
            const covered = videos.some((other) => {
              if (other === video || other.parentElement !== video.parentElement) return false;
              const above = globalThis.getComputedStyle(other);
              return Number(above.opacity) === 1 && Number(above.zIndex) > Number(style.zIndex);
            });
            if (Number(style.opacity) > 0 && !covered) {
              presented = false;
              const frameReady = (_now, metadata) => {
                if (fps && Math.abs(metadata.mediaTime - Math.floor(position * fps) / fps) > 0.5 / fps) {
                  frameRequest = video.requestVideoFrameCallback(frameReady);
                  return;
                }
                frameRequest = null;
                presented = true;
                done();
              };
              frameRequest = video.requestVideoFrameCallback(frameReady);
            }
          }
          video.addEventListener("seeked", decoded, { once: true });
          video.addEventListener("error", failed, { once: true });
          video.currentTime = position;
        });
      if (ended) {
        entry.ended = true;
        entry.playing = false;
        entry.base = position;
        entry.at = timeMs;
        video.dispatchEvent(new globalThis.Event("ended"));
      }
    }),
  );
  // Capture the native scene order: card flights stay above feedback and lyrics.
  state.initialized = true;
}
