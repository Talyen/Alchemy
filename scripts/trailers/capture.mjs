import fs from "node:fs";
import { spawnSync } from "node:child_process";
import { performance } from "node:perf_hooks";
import path from "node:path";
import { createServer } from "vite";
import { chromium } from "@playwright/test";
import { pointerPath, samplePointer, prepareAction, pointerCorridor, performAction } from "./direction.mjs";
import { nativeMusicOffsets } from "./model.mjs";
import { installCaptureRuntime, sampleVisualTime } from "./browser-runtime.mjs";
import {
  assertFrameDimensions,
  ffmpegPath,
  hashFile,
  hashValue,
  probe,
  startEncoder,
  validateSourceVideo,
  writeJson,
} from "./media.mjs";

async function sampleFrame(page, time) {
  let timeout;
  try {
    await Promise.race([
      page.evaluate(sampleVisualTime, time),
      new Promise((_, reject) => {
        timeout = globalThis.setTimeout(() => reject(new Error("Video frame presentation timed out")), 15000);
      }),
    ]);
  } finally {
    globalThis.clearTimeout(timeout);
  }
}

function finalizeClip(output, receipt) {
  const metadata = probe(output, { countFrames: false, countPackets: true });
  const video = metadata.streams.find((stream) => stream.codec_type === "video");
  validateSourceVideo(video, receipt.settings, receipt.frameCount);
  const sha256 = hashFile(output);
  if (receipt.sha256 && receipt.sha256 !== sha256) throw new Error("Retained master differs from its recorded hash");
  return { ...receipt, sha256, metadata };
}

function healthPixels(file, bounds, scale) {
  const x = Math.floor(bounds.x * scale),
    y = Math.floor(bounds.y * scale);
  const width = Math.ceil(bounds.width * scale),
    height = Math.ceil(bounds.height * scale);
  const result = spawnSync(
    ffmpegPath(),
    [
      "-v",
      "error",
      "-i",
      file,
      "-vf",
      `crop=${width}:${height}:${x}:${y},format=rgb24`,
      "-frames:v",
      "1",
      "-f",
      "md5",
      "-",
    ],
    { encoding: "utf8" },
  );
  if (result.status !== 0) throw new Error(`Could not compare recovered health pixels: ${result.stderr}`);
  return result.stdout.trim();
}

async function captureClip({
  browser,
  scenarios,
  clip,
  settings,
  origin,
  out,
  root,
  draft,
  music,
  recover = false,
  captureWindows,
  pinVideoStart = false,
  foregroundLyrics = false,
}) {
  const output = path.join(out, `${clip.id}.mp4`);
  const receiptFile = path.join(out, `${clip.id}.json`);
  // A partial capture is diagnostic evidence, never a reusable successful clip.
  if (!recover && (fs.existsSync(output) || fs.existsSync(receiptFile)))
    throw new Error(`Capture already exists: ${clip.id}. Choose a fresh bundle or use render.`);
  const journalFile = path.join(out, `${clip.id}.journal.json`);
  const windows = captureWindows?.map(({ id, start, end }, index, all) => {
    const startFrame = Math.round(start * settings.fps);
    const endFrame = Math.round(end * settings.fps);
    if (
      !/^[a-z0-9]+(?:-[a-z0-9]+)*$/u.test(id) ||
      !Number.isFinite(start) ||
      !Number.isFinite(end) ||
      start < 0 ||
      end > clip.duration ||
      start >= end ||
      Math.abs(startFrame / settings.fps - start) > 0.000001 ||
      Math.abs(endFrame / settings.fps - end) > 0.000001 ||
      (index > 0 && start < all[index - 1].end) ||
      all.findIndex((window) => window.id === id) !== index ||
      recover
    )
      throw new Error(
        "Selected capture windows need unique IDs, ordered non-overlapping frame-aligned ranges, and a fresh capture",
      );
    const file = path.join(out, `${id}.mp4`);
    if (fs.existsSync(file) || fs.existsSync(path.join(out, `${id}.json`)))
      throw new Error(`Selected capture already exists: ${id}; preserve it and choose a fresh bundle`);
    return { id, start, end, startFrame, endFrame, file, encoder: null, sampled: [] };
  });
  if (windows && !windows.length) throw new Error("Selected capture needs at least one window");
  const retainedTrace = fs.existsSync(journalFile) ? journalFile : receiptFile;
  if (recover && fs.existsSync(retainedTrace)) {
    const journal = JSON.parse(fs.readFileSync(retainedTrace, "utf8"));
    const scale = draft ? 1 : settings.scale;
    if (
      journal.settings.width !== settings.viewport.width * scale ||
      journal.settings.height !== settings.viewport.height * scale ||
      journal.settings.fps !== settings.fps ||
      journal.frameCount !== Math.round(clip.duration * settings.fps)
    )
      throw new Error("Recovery journal settings differ from the requested capture");
    if (journal.recipeHash !== hashValue(clip)) throw new Error("Recovery instructions differ from recorded inputs");
    const receipt = finalizeClip(output, journal);
    writeJson(receiptFile, receipt);
    return receipt;
  }
  let checkpoint = clip.checkpoint
    ? JSON.parse(fs.readFileSync(path.resolve(root, clip.checkpoint), "utf8"))
    : undefined;
  if (recover) {
    const storage = JSON.parse(fs.readFileSync(path.join(out, `${clip.id}.storage.json`), "utf8"));
    const saved = storage.origins
      .flatMap((origin) => origin.localStorage)
      .find((entry) => entry.name === "alchemy-save-v1");
    if (!saved) throw new Error("Recovery needs the retained starting save");
    checkpoint = JSON.parse(saved.value);
    const metadata = probe(output, { countFrames: false, countPackets: true });
    const video = metadata.streams.find((stream) => stream.codec_type === "video");
    if (
      Number(video?.nb_frames) !== Math.round(clip.duration * settings.fps) ||
      Number(video?.nb_read_packets) !== Number(video.nb_frames)
    )
      throw new Error("Recovery requires a complete retained master");
  }
  const context = await browser.newContext({
    baseURL: origin,
    viewport: settings.viewport,
    deviceScaleFactor: draft ? 1 : settings.scale,
    reducedMotion: "no-preference",
    locale: "en-US",
  });
  let encoder;
  let page;
  const errors = [];
  const browserLog = [];
  try {
    page = await context.newPage();
    const cdp = await context.newCDPSession(page);
    // An additional CDP session can start with default device metrics. Pin its
    // raster density explicitly instead of relying on context emulation alone.
    await cdp.send("Emulation.setDeviceMetricsOverride", {
      width: settings.viewport.width,
      height: settings.viewport.height,
      deviceScaleFactor: draft ? 1 : settings.scale,
      mobile: false,
      screenWidth: settings.viewport.width,
      screenHeight: settings.viewport.height,
    });
    page.setDefaultTimeout(15000);
    page.on("pageerror", (error) => errors.push(error.message));
    page.on("console", (message) => {
      browserLog.push(message.text());
      if (browserLog.length > 40) browserLog.shift();
    });
    await page.addInitScript(installCaptureRuntime);
    await page.clock.install({ time: new Date("2026-01-01T00:00:00.000Z") });
    await scenarios.openTrailerScene(page, { ...clip, lyrics: music !== null }, checkpoint);
    const rasterScale = await page.evaluate(() => globalThis.devicePixelRatio);
    if (rasterScale !== (draft ? 1 : settings.scale))
      throw new Error("Browser raster density does not match the capture request");
    // Leave room for protocol travel while the staging clock is still running.
    // A one-millisecond margin can already be in the past on the next command.
    await page.clock.pauseAt(await page.evaluate(() => Date.now() + 1000));
    await page.context().storageState({ path: path.join(out, `${clip.id}${recover ? ".replay" : ""}.storage.json`) });
    const startState = await page
      .locator("[data-testid='player-health'],[data-testid='enemy-health'],[data-testid='mana-panel']")
      .allTextContents();
    await page.addStyleTag({ content: "*, *::before, *::after { cursor: none !important; }" });
    await page.mouse.move(20, 80);
    const videoFrameRates = {};
    const videoDirectory = path.join(root, "src/assets/boss-idles");
    for (const file of fs
      .readdirSync(videoDirectory)
      .filter((file) => clip.boss && file.startsWith(`${clip.boss}-idle-`) && file.endsWith(".mp4"))) {
      const video = probe(path.join(videoDirectory, file), { countFrames: false }).streams.find(
        (stream) => stream.codec_type === "video",
      );
      if (video?.r_frame_rate === video?.avg_frame_rate) {
        const [numerator, denominator] = video.r_frame_rate.split("/").map(Number);
        if (numerator > 0 && denominator > 0)
          videoFrameRates[`/src/assets/boss-idles/${file}`] = numerator / denominator;
      }
    }
    await page.evaluate(
      ({ music, videoFrameRates, pinVideoStart, foregroundLyrics }) => {
        globalThis.__trailerCapture.foregroundLyrics = foregroundLyrics;
        globalThis.__trailerCapture.start = globalThis.performance.now();
        globalThis.__trailerCapture.music = music;
        globalThis.__trailerCapture.videoFrameRates = videoFrameRates;
        if (pinVideoStart) {
          for (const video of globalThis.document.querySelectorAll("video")) {
            const entry = globalThis.__trailerCapture.videoEntry(video, 0);
            video.currentTime = 0;
            Object.assign(entry, { at: 0, base: 0, ended: false });
          }
        }
      },
      { music, videoFrameRates, pinVideoStart, foregroundLyrics },
    );
    await sampleFrame(page, 0);
    const width = settings.viewport.width * (draft ? 1 : settings.scale);
    const height = settings.viewport.height * (draft ? 1 : settings.scale);
    if (!recover && !windows) encoder = startEncoder(output, { width, height, fps: settings.fps });
    const actions = [...clip.actions].sort((a, b) => a.at - b.at);
    const performed = [];
    const frameCount = Math.round(clip.duration * settings.fps);
    let priorTime = 0;
    let actionIndex = 0;
    const sampled = [];
    const costs = { clock: 0, input: 0, visuals: 0, screenshot: 0, encode: 0 };
    const presentation = [];
    const combatFeedback = [];
    let pointer = { x: 20, y: 80 };
    let pending = null;
    const deliberateCards = actions.some((action) => action.target?.cardPriority);
    let inspection = null;
    let hoveredKey = null;
    const hoverChanges = [];
    const tooltipChanges = [];
    let tooltipSignature = "";

    for (let frame = 0; frame < frameCount; frame++) {
      let phaseStart = performance.now();
      const mark = (phase) => {
        const now = performance.now();
        costs[phase] += now - phaseStart;
        phaseStart = now;
      };
      const time = Math.round((frame * 1000) / settings.fps);
      if (time > priorTime) await page.clock.runFor(time - priorTime);
      priorTime = time;
      mark("clock");
      const seconds = frame / settings.fps;
      const next = actions[actionIndex];
      if (!pending && next && seconds >= Math.max(0, next.at - next.moveDuration)) {
        const input = await prepareAction(page, next);
        const corridorY = await pointerCorridor(page);
        pending = {
          input,
          path: pointerPath(pointer, input.point, corridorY),
          corridorY,
          start: seconds,
          end: next.at,
          moveFrames: 0,
        };
      }
      if (pending) {
        const progress =
          seconds >= pending.end ? 1 : Math.max(0, (seconds - pending.start) / (pending.end - pending.start));
        const eased = progress * progress * (3 - 2 * progress);
        pointer = samplePointer(pending.path, eased);
        await page.mouse.move(pointer.x, pointer.y);
        pending.moveFrames++;
        if (seconds >= pending.end) {
          if (
            deliberateCards &&
            pending.input.cardKey &&
            (!inspection || inspection.key !== pending.input.cardKey || seconds - inspection.at < 1)
          )
            throw new Error(
              `Card play needs a deliberate one-second inspection of the same card: ${pending.input.label}`,
            );
          if (deliberateCards && pending.input.cardKey) {
            const title = pending.input.label.replace(/^Play /u, "");
            if (!(await page.locator('[role="tooltip"][data-visible]').filter({ hasText: title }).isVisible()))
              throw new Error(`The inspected card tooltip was not visible before playing: ${title}`);
            pending.input.inspectedFor = seconds - inspection.at;
          }
          await performAction(page, pending.input);
          if (pending.input.kind === "hover" && pending.input.inspectedCardKey)
            inspection = { key: pending.input.inspectedCardKey, at: seconds };
          if (pending.input.cardKey) {
            // Clear the hand before its reflow can hover a different card under
            // the stationary pointer. No sampled frame sees that incidental hover.
            // Newly earned status icons can occupy the hand corridor. Park in
            // the existing move-away margin so feedback never opens a tooltip.
            pointer = { x: 20, y: 80 };
            await page.mouse.move(pointer.x, pointer.y);
            inspection = null;
          }
          performed.push({
            at: seconds,
            movementFrom: pending.start,
            moveFrames: pending.moveFrames,
            path: pending.path,
            ...(pending.input.cardKey ? { retreat: pointer } : {}),
            ...pending.input,
          });
          pending = null;
          actionIndex++;
        }
      }
      mark("input");
      await sampleFrame(page, time);
      for (const input of performed.filter((input) => input.cardKey && input.acceptedAt === undefined)) {
        const stillInHand = await page.evaluate(
          (key) =>
            [...globalThis.document.querySelectorAll("[data-hand-slot]")].some(
              (slot) => slot.getAttribute("data-hand-slot") === key && !slot.hasAttribute("data-hand-hidden"),
            ),
          input.cardKey,
        );
        if (!stillInHand) input.acceptedAt = frame / settings.fps;
        else if (frame / settings.fps - input.at > 0.75) throw new Error(`Card input was not accepted: ${input.label}`);
      }
      const observed = await page.evaluate(() => ({
        tooltips: [...globalThis.document.querySelectorAll('[role="tooltip"][data-visible]')]
          .filter((node) => Number(globalThis.getComputedStyle(node).opacity) > 0)
          .map((node) => node.textContent),
        hovered:
          globalThis.document
            .querySelector("[data-hand-slot][data-hovered]:not([data-hand-hidden])")
            ?.getAttribute("data-hand-slot") ?? null,
        feedback: [...globalThis.document.querySelectorAll("[data-testid='combat-feedback-action']")].map((node) => {
          const style = globalThis.getComputedStyle(node);
          return {
            text: node.textContent,
            target: node.closest("[data-target]")?.getAttribute("data-target"),
            lane: node.parentElement.getAttribute("data-feedback-lane"),
            opacity: Number(style.opacity),
            scale: style.transform,
            rise: style.getPropertyValue("--combat-text-rise"),
          };
        }),
      }));
      const hovered = observed.hovered;
      const nextTooltipSignature = JSON.stringify(observed.tooltips);
      if (nextTooltipSignature !== tooltipSignature) {
        tooltipChanges.push({ at: seconds, texts: observed.tooltips });
        tooltipSignature = nextTooltipSignature;
      }
      if (observed.feedback.length) combatFeedback.push({ at: seconds, entries: observed.feedback });
      if (deliberateCards && hovered && hovered !== inspection?.key && hovered !== pending?.input.inspectedCardKey)
        throw new Error(`Pointer hovered an unintended card at ${seconds}s: ${hovered}`);
      if (hovered !== hoveredKey) {
        hoverChanges.push({ at: seconds, key: hovered });
        hoveredKey = hovered;
      }
      mark("visuals");
      // The general screenshot API waits for stable frames and encodes compact
      // PNGs. Direct capture preserves the sampled frame and uses fast lossless
      // compression; image quality and timing are unchanged.
      const window = windows?.find((range) => frame >= range.startFrame && frame < range.endFrame);
      const windowFrame = window ? frame - window.startFrame : null;
      const windowReview =
        window &&
        [0, Math.floor((window.endFrame - window.startFrame) / 2), window.endFrame - window.startFrame - 1].includes(
          windowFrame,
        );
      const reviewFrame = frame === 0 || frame === Math.floor(frameCount / 2) || frame === frameCount - 1;
      if ((!recover && (!windows || window)) || reviewFrame) {
        const { data } = await cdp.send("Page.captureScreenshot", {
          format: "png",
          fromSurface: true,
          captureBeyondViewport: false,
          optimizeForSpeed: true,
          clip: { x: 0, y: 0, ...settings.viewport, scale: 1 },
        });
        const png = Buffer.from(data, "base64");
        assertFrameDimensions(png, width, height);
        mark("screenshot");
        if (encoder) await encoder.frame(png);
        if (window) {
          if (!window.encoder) {
            window.startState = await page
              .locator("[data-testid='player-health'],[data-testid='enemy-health'],[data-testid='mana-panel']")
              .allTextContents();
            window.encoder = startEncoder(window.file, { width, height, fps: settings.fps });
          }
          await window.encoder.frame(png);
          if (windowReview) {
            const name = `${window.id}-${windowFrame}.png`;
            fs.writeFileSync(path.join(out, name), png);
            window.sampled.push({ frame: windowFrame, sha256: hashFile(path.join(out, name)), file: name });
          }
          if (frame === window.endFrame - 1) {
            await window.encoder.finish();
            window.encoder = null;
            window.endState = await page
              .locator("[data-testid='player-health'],[data-testid='enemy-health'],[data-testid='mana-panel']")
              .allTextContents();
          }
        }
        mark("encode");
        if (reviewFrame) {
          const name = `${clip.id}-${frame}.png`;
          const original = path.join(out, name);
          if (recover) {
            assertFrameDimensions(fs.readFileSync(original), width, height);
            const replay = path.join(out, `${clip.id}-replay-${frame}.png`);
            fs.writeFileSync(replay, png);
            for (const testId of ["player-health", "enemy-health"]) {
              const bounds = await page.getByTestId(testId).boundingBox();
              if (!bounds || healthPixels(original, bounds, rasterScale) !== healthPixels(replay, bounds, rasterScale))
                throw new Error(`Recovered health pixels differ at frame ${frame}: ${testId}`);
            }
          } else fs.writeFileSync(original, png);
          sampled.push({ frame, sha256: hashFile(original), file: name });
        }
      }
      if (frame % settings.fps === 0) {
        presentation.push(
          await page.evaluate(
            (at) => ({
              at,
              health: [
                ...globalThis.document.querySelectorAll(
                  "[data-testid='player-health'],[data-testid='enemy-health'],[data-testid='mana-panel']",
                ),
              ].map((node) => node.textContent),
              battle: Boolean(globalThis.document.querySelector("[data-testid='battle-scene']")),
              visibleTooltips: [...globalThis.document.querySelectorAll('[role="tooltip"][data-visible]')]
                .filter((node) => Number(globalThis.getComputedStyle(node).opacity) > 0)
                .map((node) => node.textContent),
              lyrics: globalThis.document.querySelector("[data-testid='boss-lyrics']")?.textContent ?? null,
              lyricBounds: (() => {
                const rect = globalThis.document.querySelector("[data-testid='boss-lyrics']")?.getBoundingClientRect();
                return rect ? { x: rect.x, y: rect.y, width: rect.width, height: rect.height } : null;
              })(),
              bossBounds: (() => {
                const rect = globalThis.document
                  .querySelector("[data-testid='battle-enemy-art-panel']")
                  ?.getBoundingClientRect();
                return rect ? { x: rect.x, y: rect.y, width: rect.width, height: rect.height } : null;
              })(),
              lyricOverflow: (() => {
                const lyrics = globalThis.document.querySelector("[data-testid='boss-lyrics']");
                return lyrics ? lyrics.scrollWidth > lyrics.clientWidth : false;
              })(),
              videos: [...globalThis.document.querySelectorAll("video")].map((video) => ({
                src: new URL(video.src).pathname,
                time: video.currentTime,
                width: video.videoWidth,
                height: video.videoHeight,
                objectFit: globalThis.getComputedStyle(video).objectFit,
                opacity: globalThis.getComputedStyle(video).opacity,
                bounds: (() => {
                  const rect = video.getBoundingClientRect();
                  return { x: rect.x, y: rect.y, width: rect.width, height: rect.height };
                })(),
                playing: globalThis.__trailerCapture.videos.get(video)?.playing ?? false,
              })),
            }),
            frame / settings.fps,
          ),
        );
        console.log(
          `Capture ${clip.id}: ${frame / settings.fps}/${clip.duration}s (${width}×${height}, ${settings.fps} fps); phase ms ${JSON.stringify(Object.fromEntries(Object.entries(costs).map(([key, value]) => [key, Math.round(value)])))}`,
        );
      }
      if (errors.length) throw new Error(`Renderer error: ${errors.join("; ")}`);
    }
    if (actionIndex !== actions.length) throw new Error("Not all directed actions were executed");
    if (performed.some((input) => input.cardKey && input.acceptedAt === undefined))
      throw new Error("Clip ended before the last card play was accepted");
    if (encoder) await encoder.finish();
    encoder = null;
    const sounds = await page.evaluate(
      (duration) => globalThis.__trailerCapture.sounds.map((sound) => ({ ...sound, end: sound.end ?? duration })),
      clip.duration,
    );
    if (sounds.some((sound) => sound.at < 0 || sound.at >= clip.duration || sound.end < sound.at))
      throw new Error("Sound cue clock diverged from the captured frame timeline");
    if (clip.actions.some((action) => action.kind === "play-card") && !sounds.length)
      throw new Error("No sound cues observed for directed card plays");
    if (clip.scene === "boss" && presentation.some((sample) => !sample.battle))
      throw new Error("Directed battle left the battle screen during capture");
    if (music?.expectLyrics && !presentation.some((sample) => sample.lyrics?.trim()))
      throw new Error("Native battle lyrics were not observed; check the selected soundtrack interval");
    const endState = await page
      .locator("[data-testid='player-health'],[data-testid='enemy-health'],[data-testid='mana-panel']")
      .allTextContents();
    const endStorage = await context.storageState();
    const endSave = endStorage.origins
      .flatMap((origin) => origin.localStorage)
      .find((entry) => entry.name === "alchemy-save-v1");
    const endCheckpointFile = `${clip.id}.end-save.json`;
    if (endSave) writeJson(path.join(out, endCheckpointFile), JSON.parse(endSave.value));
    const journal = {
      version: 1,
      hoverChanges,
      tooltipChanges,
      id: clip.id,
      recipeHash: hashValue(clip),
      checkpointHash: checkpoint ? hashValue(checkpoint) : null,
      file: path.basename(output),
      settings: { width, height, fps: settings.fps },
      rasterScale,
      frameCount,
      elapsedPhaseMs: costs,
      method: "offline-js-css-video-sampling",
      nativeSceneLayering: true,
      ...(pinVideoStart ? { mediaPhase: "active native video buffers pinned to frame zero before sampling" } : {}),
      startState,
      endState,
      ...(endSave
        ? { endCheckpoint: { file: endCheckpointFile, sha256: hashFile(path.join(out, endCheckpointFile)) } }
        : {}),
      actions: performed,
      nativeMusic: music,
      presentation,
      combatFeedback,
      sounds,
      sampled,
      ...(recover
        ? {
            recovery: {
              traceOrigin: "replayed from retained starting save; original video unchanged",
              matchedHealthPixelsAtFrames: sampled.map((sample) => sample.frame),
            },
          }
        : {}),
    };
    // Save actual interaction/sound evidence before any expensive media work.
    writeJson(journalFile, journal);
    if (windows) {
      const selections = windows.map((window) => {
        const localTime = (value) => value - window.start;
        const selected = {
          ...journal,
          id: window.id,
          file: path.basename(window.file),
          recipeHash: hashValue({ clip, captureWindow: { id: window.id, start: window.start, end: window.end } }),
          frameCount: window.endFrame - window.startFrame,
          sourceWindow: { replayClip: clip.id, start: window.start, end: window.end, recipeHash: journal.recipeHash },
          startState: window.startState,
          endState: window.endState,
          sampled: window.sampled,
          nativeMusic: music ? { ...music, offset: music.offset + window.start } : null,
          actions: performed
            .filter((input) => input.at >= window.start && input.at < window.end)
            .map((input) => ({
              ...input,
              at: localTime(input.at),
              movementFrom: localTime(input.movementFrom),
              ...(input.acceptedAt === undefined ? {} : { acceptedAt: localTime(input.acceptedAt) }),
            })),
          presentation: presentation
            .filter((sample) => sample.at >= window.start && sample.at < window.end)
            .map((sample) => ({ ...sample, at: localTime(sample.at) })),
          combatFeedback: combatFeedback
            .filter((sample) => sample.at >= window.start && sample.at < window.end)
            .map((sample) => ({ ...sample, at: localTime(sample.at) })),
          hoverChanges: hoverChanges
            .filter((sample) => sample.at >= window.start && sample.at < window.end)
            .map((sample) => ({ ...sample, at: localTime(sample.at) })),
          sounds: sounds
            .filter((sound) => sound.at < window.end && sound.end > window.start)
            .map((sound) => ({
              ...sound,
              at: Math.max(0, localTime(sound.at)),
              end: Math.min(window.end - window.start, localTime(sound.end)),
              offset: (sound.offset ?? 0) + Math.max(0, window.start - sound.at),
            })),
        };
        const receipt = finalizeClip(window.file, selected);
        writeJson(path.join(out, `${window.id}.json`), receipt);
        return receipt;
      });
      return { selections };
    }
    const receipt = finalizeClip(output, journal);
    writeJson(receiptFile, receipt);
    return receipt;
  } catch (error) {
    if (encoder) await encoder.abort();
    for (const window of windows ?? []) if (window.encoder) await window.encoder.abort();
    if (page) await page.screenshot({ path: path.join(out, `${clip.id}.failure.png`), timeout: 5000 }).catch(() => {});
    writeJson(path.join(out, `${clip.id}.failure.json`), {
      error: error.stack ?? String(error),
      url: page?.url(),
      rendererErrors: errors,
      browserLog,
    });
    throw error;
  } finally {
    await context.close();
  }
}

export async function captureRecipe({
  root,
  recipe,
  out,
  draft = false,
  source,
  recover = false,
  clipIds,
  captureWindows,
  pinVideoStart = false,
  foregroundLyrics = false,
}) {
  if (foregroundLyrics)
    throw new Error("Foreground lyric compositing is retired; capture native in-scene layering instead");
  if (!recover)
    writeJson(path.join(out, "capture-start.json"), {
      recipe,
      draft,
      source,
      pinVideoStart,
      foregroundLyrics,
      ...(captureWindows ? { captureWindows } : {}),
    });
  fs.mkdirSync(path.join(out, "clips"), { recursive: true });
  const dependencies = Object.keys(
    JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8")).dependencies,
  ).filter((name) => !["@sentry/electron", "steamworks.js"].includes(name));
  const server = await createServer({
    root,
    define: { "import.meta.env.DEV": "false" },
    cacheDir: path.join(root, "scratch/trailer-vite-cache"),
    // A recording is pinned to its starting source. File changes and lazy
    // dependency optimization must not hot-reload an in-progress encounter.
    server: { host: "127.0.0.1", port: 0, strictPort: true, open: false, hmr: false, watch: null },
    optimizeDeps: {
      noDiscovery: true,
      include: [...dependencies, "react-dom/client", "react/jsx-runtime", "react/jsx-dev-runtime", "motion/react"],
    },
    logLevel: "warn",
  });
  let browser;
  try {
    await server.listen();
    // Prepare the eager client graph before navigation starts its timeout.
    // SSR staging warms a separate graph and leaves the first browser boot cold.
    await Promise.all([server.warmupRequest("/src/startup.ts"), server.warmupRequest("/src/main.tsx")]);
    await server.environments.client.waitForRequestsIdle();
    const address = server.httpServer.address();
    const origin = `http://127.0.0.1:${address.port}`;
    browser = await chromium.launch({
      channel: "chromium",
      headless: true,
      args: ["--autoplay-policy=no-user-gesture-required"],
    });
    const scenarios = await server.ssrLoadModule("/tests/trailers/scenarios.ts");
    const assets = scenarios.trailerAssets(recipe.music.boss);
    const musicSource = path.resolve(root, assets.music);
    const lyricsSource = path.resolve(root, `src/lib/audio/lyrics/${recipe.music.boss}.json`);
    const lyrics = JSON.parse(fs.readFileSync(lyricsSource, "utf8"));
    if (lyrics.audioSha256 !== hashFile(musicSource))
      throw new Error("Lyric snapshot does not match soundtrack recording");
    fs.mkdirSync(path.join(out, "assets"), { recursive: true });
    fs.copyFileSync(musicSource, path.join(out, "assets/music.mp3"));
    fs.copyFileSync(path.resolve(root, `.${assets.logo}`), path.join(out, "assets/logo.webp"));
    fs.copyFileSync(path.join(root, "public/fonts/Inter.woff2"), path.join(out, "assets/Inter.woff2"));
    writeJson(path.join(out, "assets/lyrics.json"), lyrics);
    const offsets = nativeMusicOffsets(recipe);
    const clips = {};
    for (const clip of recipe.clips) {
      const receiptFile = path.join(out, "clips", `${clip.id}.json`);
      if (!recover && !captureWindows && fs.existsSync(receiptFile)) {
        const recorded = JSON.parse(fs.readFileSync(receiptFile, "utf8"));
        if (recorded.recipeHash !== hashValue(clip) || recorded.nativeMusic?.offset !== offsets[clip.id])
          throw new Error(`Retained capture instructions differ: ${clip.id}`);
        clips[clip.id] = finalizeClip(path.join(out, "clips", recorded.file), recorded);
        continue;
      }
      if (clipIds && !clipIds.includes(clip.id)) continue;
      console.log(`Capturing ${clip.id}: ${clip.duration}s`);
      const captured = await captureClip({
        browser,
        scenarios,
        clip,
        settings: recipe.capture,
        origin,
        out: path.join(out, "clips"),
        root,
        draft,
        recover,
        captureWindows: captureWindows?.[clip.id],
        pinVideoStart,
        foregroundLyrics,
        music:
          offsets[clip.id] === undefined
            ? null
            : {
                offset: offsets[clip.id],
                expectLyrics: lyrics.lines.some(
                  (line) =>
                    line.timings[0] < offsets[clip.id] + clip.duration && line.timings.at(-1) > offsets[clip.id],
                ),
                src: new URL(assets.music.replace(/^public/u, ""), origin).pathname,
              },
      });
      if (captured.selections) for (const selected of captured.selections) clips[selected.id] = selected;
      else clips[clip.id] = captured;
    }
    for (const clip of Object.values(clips)) {
      for (const sound of clip.sounds) {
        const relative = decodeURIComponent(sound.src).replace(/^\//u, "");
        const src = path.resolve(root, "public", relative);
        if (!src.startsWith(path.resolve(root, "public/sounds") + path.sep))
          throw new Error(`Invalid SFX path ${sound.src}`);
        const dest = path.join(out, "assets/sfx", path.basename(src));
        fs.mkdirSync(path.dirname(dest), { recursive: true });
        fs.copyFileSync(src, dest);
        sound.file = path.relative(out, dest);
      }
      writeJson(path.join(out, "clips", `${clip.id}.json`), clip);
    }
    const bundle = {
      version: 1,
      recipe,
      draft,
      source,
      browserVersion: browser.version(),
      clips,
      complete: captureWindows
        ? Object.values(captureWindows)
            .flat()
            .every((window) => clips[window.id])
        : Object.keys(clips).length === recipe.clips.length,
      ...(captureWindows ? { captureMode: "selected-windows", captureWindows } : {}),
      music: { file: "assets/music.mp3", sha256: hashFile(musicSource), duration: lyrics.audioDuration },
      lyrics,
      assets: { logo: "assets/logo.webp", font: "assets/Inter.woff2" },
    };
    writeJson(path.join(out, "capture.json"), bundle);
    return bundle;
  } finally {
    if (browser) await browser.close();
    await server.close();
  }
}
