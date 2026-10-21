/**
 * src/api/server.js
 *
 * Endpoint que a app Flutter chama (via Supabase edge function ou
 * directamente, dependendo da rede) para pedir os renders de um evento.
 * Devolve job IDs; o estado é consultado via GET /render-jobs/:kind/:id
 * ou (em produção) via subscrição Realtime à tabela render_jobs.
 */

const express = require("express");
const fs = require("fs");
const path = require("path");
const { execFile } = require("child_process");
const { OUTPUT_DIR } = require("../storage/storage-client");
const { videoQueue, overlayQueue, pdfQueue, imageQueue } = require("../queue/queues/render.queues");

const app = express();
app.use(express.json({ limit: "2mb" }));

// Usado pelo healthcheck do docker-compose e pelo passo de verificação
// pós-deploy do GitHub Actions (ver production/ci/video_service_deploy.yml).
// Não confirma que o Redis/FFmpeg estão bem — só que o processo Express
// está vivo e a responder; suficiente para detectar um deploy que falhou
// a arrancar.
// Ficheiros gerados (vídeo/PDF/PNG) — a app descarrega daqui para
// pré-visualizar e para partilhar. express.static já suporta Range (seek
// de vídeo) e protege contra path traversal.
app.use("/files", (req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  next();
});
app.use("/files", express.static(OUTPUT_DIR, { fallthrough: false }));

// Pré-visualização da 1.ª página de um PDF gerado, como PNG (usa
// pdftoppm, do pacote poppler-utils instalado na imagem Docker).
app.get("/preview/pdf", (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  const rel = String(req.query.file || "");
  const root = path.resolve(OUTPUT_DIR);
  const full = path.resolve(root, rel);
  if (!full.startsWith(root + path.sep) || !full.endsWith(".pdf") || !fs.existsSync(full)) {
    return res.status(404).json({ error: "pdf não encontrado" });
  }
  const outBase = full.slice(0, -4) + "-preview";
  const png = outBase + ".png";
  const send = () => res.sendFile(png);
  if (fs.existsSync(png)) return send();
  execFile(
    "pdftoppm",
    ["-png", "-r", "100", "-f", "1", "-l", "1", "-singlefile", full, outBase],
    (err) => {
      if (err) return res.status(500).json({ error: "falha ao gerar pré-visualização do PDF" });
      send();
    }
  );
});

app.get("/health", (req, res) => res.status(200).json({ status: "ok" }));

app.post("/render-jobs/base", async (req, res) => {
  const { eventId, config, lang } = req.body;
  if (!eventId || !config) return res.status(400).json({ error: "eventId e config são obrigatórios" });

  const job = await videoQueue.add("base", { eventId, config, lang: lang || "pt" });
  res.status(202).json({ jobId: job.id, queue: "render-video" });
});

app.post("/render-jobs/pdf", async (req, res) => {
  const { eventId, config, inviteLink, lang } = req.body;
  const job = await pdfQueue.add("pdf", { eventId, config, inviteLink, lang: lang || "pt" });
  res.status(202).json({ jobId: job.id, queue: "render-pdf" });
});

app.post("/render-jobs/image", async (req, res) => {
  const { eventId, config, inviteLink, lang } = req.body;
  const job = await imageQueue.add("image", { eventId, config, inviteLink, lang: lang || "pt" });
  res.status(202).json({ jobId: job.id, queue: "render-image" });
});

app.post("/render-jobs/guest-overlay", async (req, res) => {
  const { eventId, guestId, guestName, config, lang, baseVideoPath } = req.body;
  if (!baseVideoPath) return res.status(400).json({ error: "baseVideoPath é obrigatório (render base primeiro)" });

  const job = await overlayQueue.add("overlay", { eventId, guestId, guestName, config, lang: lang || "pt", baseVideoPath });
  res.status(202).json({ jobId: job.id, queue: "render-video-overlay" });
});

const QUEUES = {
  "render-video": videoQueue,
  "render-video-overlay": overlayQueue,
  "render-pdf": pdfQueue,
  "render-image": imageQueue,
};

app.get("/render-jobs/:queue/:id", async (req, res) => {
  const queue = QUEUES[req.params.queue];
  if (!queue) return res.status(404).json({ error: "fila desconhecida" });

  const job = await queue.getJob(req.params.id);
  if (!job) return res.status(404).json({ error: "job não encontrado" });

  const state = await job.getState();
  res.json({ id: job.id, state, progress: job.progress, returnvalue: job.returnvalue, failedReason: job.failedReason });
});

const PORT = process.env.PORT || 4000;
if (require.main === module) {
  app.listen(PORT, () => console.log(`[api] a ouvir em http://127.0.0.1:${PORT}`));
}

module.exports = { app };
