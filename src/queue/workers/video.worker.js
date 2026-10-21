/**
 * src/queue/workers/video.worker.js
 *
 * Dois workers:
 *  - render-video: gera o vídeo-base do evento (1x, cacheado por config_hash).
 *  - render-video-overlay: gera o overlay leve do nome (Opção B), reaproveitando
 *    o vídeo-base já pronto, concatenado sem re-encode.
 */

const path = require("path");
const { Worker } = require("bullmq");
const { connection } = require("../connection");
const { buildBaseVideo } = require("../../renderers/video/build-base-video");
const { overlayGuestName } = require("../../renderers/video/overlay-guest-name");
const { LocalStorageClient } = require("../../storage/storage-client");
const cache = require("../../cache/render-cache");

const storage = new LocalStorageClient();

const videoWorker = new Worker(
  "render-video",
  async (job) => {
    const { eventId, config, lang } = job.data;
    const configHash = cache.hashConfig(config);
    const key = cache.cacheKey({ configHash, kind: "video_base" });

    const existing = await cache.get(key);
    if (existing && existing.status === "pronto") {
      job.log(`cache hit para ${key}, a saltar render`);
      return existing;
    }

    job.updateProgress(10);
    const relPath = `events/${eventId}/video-base-${configHash}.mp4`;
    const tmpOut = storage.resolvePath(relPath);
    const result = await buildBaseVideo(config, tmpOut, lang);
    job.updateProgress(90);

    const record = {
      status: "pronto",
      path: result.path,
      bytes: result.bytes,
      durationSec: result.durationSec,
      configHash,
    };
    await cache.set(key, record);
    job.updateProgress(100);
    return record;
  },
  { connection, concurrency: 2 }
);

const overlayWorker = new Worker(
  "render-video-overlay",
  async (job) => {
    const { eventId, guestId, guestName, config, lang, baseVideoPath } = job.data;
    const configHash = cache.hashConfig(config);
    const key = cache.cacheKey({ configHash, kind: "video_overlay", guestName });

    const existing = await cache.get(key);
    if (existing && existing.status === "pronto") {
      job.log(`cache hit para ${key} (nome "${guestName}"), a saltar render`);
      return existing;
    }

    const normalized = cache.normalizeGuestName(guestName);
    const relPath = `events/${eventId}/guests/video-${normalized}-${configHash}.mp4`;
    const outPath = storage.resolvePath(relPath);

    const result = await overlayGuestName({
      baseVideoPath,
      guestName,
      theme: config.theme,
      outPath,
      lang,
    });

    const record = { status: "pronto", path: result.path, bytes: result.bytes, configHash, guestId };
    await cache.set(key, record);
    return record;
  },
  { connection, concurrency: 4 } // mais concorrência: job é barato (Opção B)
);

videoWorker.on("failed", (job, err) => console.error(`[video.worker] job ${job?.id} falhou:`, err));
overlayWorker.on("failed", (job, err) => console.error(`[overlay.worker] job ${job?.id} falhou:`, err));

videoWorker.on("active", (job) => console.log(`[video.worker] a processar job ${job.id}`));
videoWorker.on("completed", (job) => console.log(`[video.worker] concluído job ${job.id}`));
overlayWorker.on("active", (job) => console.log(`[overlay.worker] a processar job ${job.id}`));
overlayWorker.on("completed", (job) => console.log(`[overlay.worker] concluído job ${job.id}`));

module.exports = { videoWorker, overlayWorker };
