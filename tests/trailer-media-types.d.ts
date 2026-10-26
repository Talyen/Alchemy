declare module "*scripts/trailers/media.mjs" {
  export function assertFrameDimensions(buffer: Buffer, width: number, height: number): void;
  export function validateSourceVideo(
    video: {
      width: number;
      height: number;
      codec_name: string;
      pix_fmt: string;
      r_frame_rate: string;
      nb_frames: string;
      nb_read_packets: string;
    },
    settings: { width: number; height: number; fps: number },
    frameCount: number,
  ): void;
}
