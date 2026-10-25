import React, { useEffect, useState } from "react";
import {
  AbsoluteFill,
  Composition,
  Img,
  Sequence,
  interpolate,
  registerRoot,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
  delayRender,
  continueRender,
  cancelRender,
} from "remotion";

const asset = (file) => staticFile(file);
const ease = (t) => t * t * (3 - 2 * t);
function Shot({ shot, clip }) {
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();
  const progress = ease(Math.min(1, frame / Math.max(1, shot.durationInFrames - 1)));
  const camera = Object.fromEntries(
    ["x", "y", "zoom"].map((key) => [key, interpolate(progress, [0, 1], [shot.camera.from[key], shot.camera.to[key]])]),
  );
  const scale = Math.max(width / clip.settings.width, height / clip.settings.height) * camera.zoom;
  const videoWidth = clip.settings.width * scale;
  const videoHeight = clip.settings.height * scale;
  const transition = shot.transitionFrames === 0 ? 1 : Math.min(1, frame / shot.transitionFrames);
  const left = Math.max(width - videoWidth, Math.min(0, width / 2 - camera.x * videoWidth));
  const top = Math.max(height - videoHeight, Math.min(0, height / 2 - camera.y * videoHeight));
  return (
    <AbsoluteFill
      style={{
        overflow: "hidden",
        opacity: shot.transition.kind === "dissolve" ? transition : 1,
        clipPath: shot.transition.kind === "wipe" ? `inset(0 ${(1 - transition) * 100}% 0 0)` : undefined,
      }}
    >
      <Img
        src={
          clip.frameUrl
            ? `${clip.frameUrl}/${Math.min(clip.frameCount - 1, Math.floor(shot.sourceStartFrame + frame * shot.speed))}.png`
            : asset(
                `${clip.frames}/${String(Math.min(clip.frameCount - 1, Math.floor(shot.sourceStartFrame + frame * shot.speed))).padStart(6, "0")}.png`,
              )
        }
        style={{ position: "absolute", width: videoWidth, height: videoHeight, left, top, maxWidth: "none" }}
      />
    </AbsoluteFill>
  );
}

function Trailer({ timeline, bundle, recipe }) {
  const [fontHandle] = useState(() => delayRender("Loading trailer font"));
  useEffect(() => {
    const font = new globalThis.FontFace("AlchemyTrailer", `url('${asset(bundle.assets.font)}')`);
    font
      .load()
      .then((loaded) => {
        globalThis.document.fonts.add(loaded);
        continueRender(fontHandle);
      })
      .catch(cancelRender);
  }, [bundle.assets.font, fontHandle]);
  const frame = useCurrentFrame();
  const endProgress = ease(Math.min(1, Math.max(0, (frame - timeline.endCardFrom) / Math.max(1, timeline.fps * 0.5))));
  return (
    <AbsoluteFill style={{ backgroundColor: "#080b10", fontFamily: "AlchemyTrailer, sans-serif" }}>
      {timeline.shots.map((shot, index) => (
        <Sequence key={index} from={shot.from} durationInFrames={shot.durationInFrames}>
          <Shot shot={shot} clip={bundle.clips[shot.clip]} />
        </Sequence>
      ))}
      {recipe.endCard.duration > 0 && (
        <Sequence from={timeline.endCardFrom}>
          <AbsoluteFill
            style={{
              alignItems: "center",
              justifyContent: "center",
              background: "radial-gradient(ellipse at center, #28302a 0%, #0c1215 55%, #05080a 100%)",
              opacity: endProgress,
            }}
          >
            <Img
              src={asset(bundle.assets.logo)}
              style={{
                width: "74%",
                maxHeight: "48%",
                objectFit: "contain",
                transform: `scale(${0.96 + 0.04 * endProgress})`,
                filter: "drop-shadow(0 12px 25px #0008)",
              }}
            />
            <div
              style={{
                color: "#f5d99c",
                fontSize: timeline.width * 0.035,
                letterSpacing: "0.06em",
                marginTop: timeline.height * 0.04,
                textAlign: "center",
                padding: "0 8%",
              }}
            >
              {recipe.endCard.text}
            </div>
          </AbsoluteFill>
        </Sequence>
      )}
    </AbsoluteFill>
  );
}

registerRoot(() => (
  <Composition
    id="AlchemyTrailer"
    component={Trailer}
    width={1920}
    height={1080}
    fps={60}
    durationInFrames={60}
    defaultProps={{
      timeline: { shots: [], fps: 60, endCardFrom: 0, width: 1920, height: 1080 },
      bundle: { clips: {}, lyrics: { lines: [] }, assets: { font: "assets/Inter.woff2", logo: "assets/logo.webp" } },
      recipe: { music: { lyrics: false, offset: 0 }, endCard: { text: "Alchemy" } },
    }}
    calculateMetadata={({ props }) => ({
      width: props.timeline.width,
      height: props.timeline.height,
      fps: props.timeline.fps,
      durationInFrames: props.timeline.durationInFrames,
    })}
  />
));
