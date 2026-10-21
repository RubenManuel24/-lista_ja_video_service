const { Worker } = require("bullmq");
const { connection } = require("../connection");
const { buildPdfA5 } = require("../../renderers/pdf/build-pdf-a5");
const { buildPng1080x1350 } = require("../../renderers/image/build-png-1080x1350");
const { LocalStorageClient } = require("../../storage/storage-client");
const cache = require("../../cache/render-cache");

const storage = new LocalStorageClient();

const pdfWorker = new Worker(
  "render-pdf",
  async (job) => {
    const { eventId, config, inviteLink, lang } = job.data;
    const configHash = cache.hashConfig(config);
    const key = cache.cacheKey({ configHash, kind: "pdf" });

    const existing = await cache.get(key);
    if (existing && existing.status === "pronto") return existing;

    const bytes = await buildPdfA5(config, inviteLink, lang);
    const relPath = `events/${eventId}/convite-a5-${configHash}.pdf`;
    const saved = await storage.put(relPath, Buffer.from(bytes));

    const record = { status: "pronto", path: saved.path, bytes: saved.bytes, configHash };
    await cache.set(key, record);
    return record;
  },
  { connection, concurrency: 4 }
);

const imageWorker = new Worker(
  "render-image",
  async (job) => {
    const { eventId, config, inviteLink, lang } = job.data;
    const configHash = cache.hashConfig(config);
    const key = cache.cacheKey({ configHash, kind: "png" });

    const existing = await cache.get(key);
    if (existing && existing.status === "pronto") return existing;

    const buffer = await buildPng1080x1350(config, inviteLink, lang);
    const relPath = `events/${eventId}/convite-1080x1350-${configHash}.png`;
    const saved = await storage.put(relPath, buffer);

    const record = { status: "pronto", path: saved.path, bytes: saved.bytes, configHash };
    await cache.set(key, record);
    return record;
  },
  { connection, concurrency: 4 }
);

pdfWorker.on("failed", (job, err) => console.error(`[pdf.worker] job ${job?.id} falhou:`, err));
imageWorker.on("failed", (job, err) => console.error(`[image.worker] job ${job?.id} falhou:`, err));

pdfWorker.on("active", (job) => console.log(`[pdf.worker] a processar job ${job.id}`));
pdfWorker.on("completed", (job) => console.log(`[pdf.worker] concluído job ${job.id}`));
imageWorker.on("active", (job) => console.log(`[image.worker] a processar job ${job.id}`));
imageWorker.on("completed", (job) => console.log(`[image.worker] concluído job ${job.id}`));

module.exports = { pdfWorker, imageWorker };
