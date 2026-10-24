/** Runs only inside the isolated recording page; production code stays untouched. */
export function installCaptureRuntime() {
  const { window } = globalThis;
  const state = { start: null, sounds: [], animations: new Map(), videos: new Map(), initialized: false };
  const NativeAudio = window.Audio;
  window.Audio = class extends NativeAudio {
    play() {
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
      this.captureEvent = null;
      super.pause();
    }
  };
  window.__trailerCapture = state;
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
      return play.call(this).then(() => {
        if (state.start !== null) pause.call(this);
      });
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
  await Promise.all(
    [...document.querySelectorAll("video")].map(async (video) => {
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
      state.pauseVideo(video);
      const elapsed = entry.base + (entry.playing ? ((timeMs - entry.at) / 1000) * video.playbackRate : 0);
      const ended = entry.playing && !video.loop && elapsed >= video.duration && !entry.ended;
      const position = video.loop ? elapsed % video.duration : Math.min(elapsed, Math.max(0, video.duration - 0.00001));
      if (Math.abs(video.currentTime - position) >= 0.0001)
        await new Promise((resolve, reject) => {
          const done = () => {
            video.removeEventListener("error", failed);
            resolve();
          };
          const failed = () => {
            video.removeEventListener("seeked", done);
            reject(new Error("Video seek failed"));
          };
          video.addEventListener("seeked", done, { once: true });
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
  state.initialized = true;
}
