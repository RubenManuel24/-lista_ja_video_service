/**
 * src/renderers/video/ffmpeg-args.js
 *
 * Todos os segmentos (base e overlay de nome) são gerados com EXACTAMENTE
 * os mesmos parâmetros de codec (resolução, fps, perfil H.264, sample rate
 * do AAC). Isto é o que permite concatenar dois segmentos já codificados
 * com "-c copy" (sem re-encode) na Opção B — o ponto central da decisão
 * de arquitectura da Fase 1/2.
 */

const VIDEO_PARAMS = {
  width: 1080,
  height: 1920,
  fps: 30,
  videoCodec: "libx264",
  profile: "high",
  pixFmt: "yuv420p",
  audioCodec: "aac",
  audioRate: 44100,
  audioBitrate: "128k",
};

/** Args para transformar 1 imagem estática num segmento de vídeo com fade. */
function imageToSegmentArgs({ imagePath, durationSec, outPath, fadeIn = 0.35, fadeOut = 0.35 }) {
  const fadeOutStart = Math.max(0, durationSec - fadeOut);
  const vf = [
    `scale=${VIDEO_PARAMS.width}:${VIDEO_PARAMS.height}`,
    `format=${VIDEO_PARAMS.pixFmt}`,
    fadeIn > 0 ? `fade=t=in:st=0:d=${fadeIn}` : null,
    fadeOut > 0 ? `fade=t=out:st=${fadeOutStart}:d=${fadeOut}` : null,
  ].filter(Boolean).join(",");

  return [
    "-y",
    "-loop", "1", "-t", String(durationSec), "-i", imagePath,
    "-f", "lavfi", "-i", `anullsrc=r=${VIDEO_PARAMS.audioRate}:cl=stereo`,
    "-t", String(durationSec),
    "-vf", vf,
    "-r", String(VIDEO_PARAMS.fps),
    "-c:v", VIDEO_PARAMS.videoCodec,
    "-profile:v", VIDEO_PARAMS.profile,
    "-pix_fmt", VIDEO_PARAMS.pixFmt,
    "-c:a", VIDEO_PARAMS.audioCodec,
    "-b:a", VIDEO_PARAMS.audioBitrate,
    "-shortest",
    outPath,
  ];
}

/** Args para concatenar segmentos já codificados de forma idêntica, sem re-encode. */
function concatArgs({ listFilePath, outPath }) {
  return ["-y", "-f", "concat", "-safe", "0", "-i", listFilePath, "-c", "copy", outPath];
}

module.exports = { VIDEO_PARAMS, imageToSegmentArgs, concatArgs };
