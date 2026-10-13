/**
 * src/renderers/video/build-base-video.js
 *
 * Gera o teaser MP4 (8-12s) UMA VEZ POR EVENTO a partir do InviteConfig.
 * Nunca inclui o nome do convidado — isso é o overlay-guest-name.js.
 */

const fs = require("fs");
const path = require("path");
const os = require("os");
const { execFile } = require("child_process");
const { promisify } = require("util");
const execFileAsync = promisify(execFile);

const { renderSlidePng } = require("./build-slide-png");
const { imageToSegmentArgs, concatArgs } = require("./ffmpeg-args");

function localizedText(field, lang, fallback) {
  if (!field) return fallback || "";
  return field[lang] || field.pt || Object.values(field)[0] || fallback || "";
}

function buildSlidesFromConfig(config, lang = "pt") {
  const colors = config.theme.colors;
  const eventDate = new Date(config.cover.eventDate);
  const dateStr = eventDate.toLocaleDateString(lang === "pt" ? "pt-PT" : "en-GB", {
    day: "2-digit", month: "long", year: "numeric",
  });

  const slides = [
    {
      duration: 3.2,
      spec: {
        title: localizedText(config.cover.title, lang),
        subtitle: localizedText(config.cover.subtitle, lang),
        lines: [dateStr],
        colors,
      },
    },
  ];

  const mainVenue = config.venues && config.venues[0];
  if (mainVenue) {
    const time = new Date(mainVenue.startTime).toLocaleTimeString(lang === "pt" ? "pt-PT" : "en-GB", {
      hour: "2-digit", minute: "2-digit",
    });
    slides.push({
      duration: 2.6,
      spec: {
        title: localizedText(mainVenue.name, lang),
        subtitle: time,
        lines: [mainVenue.location.address],
        colors,
      },
    });
  }

  slides.push({
    duration: 2.6,
    spec: {
      title: lang === "pt" ? "O controlo total de convidados" : "Total guest control",
      subtitle: "",
      lines: [lang === "pt" ? "Toque no link para abrir o convite" : "Tap the link to open the invite"],
      colors,
    },
  });

  return slides;
}

/**
 * @param {object} config InviteConfig completo
 * @param {string} outPath caminho final do mp4 (sem áudio de nome)
 * @param {string} lang
 */
async function buildBaseVideo(config, outPath, lang = "pt") {
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "listaja-video-"));
  const slides = buildSlidesFromConfig(config, lang);
  const segmentPaths = [];

  try {
    for (let i = 0; i < slides.length; i++) {
      const { duration, spec } = slides[i];
      const pngPath = path.join(tmpDir, `slide-${i}.png`);
      const segPath = path.join(tmpDir, `seg-${i}.mp4`);
      const pngBuffer = await renderSlidePng(spec);
      fs.writeFileSync(pngPath, pngBuffer);

      // A frame 0 do vídeo é usada pelo WhatsApp como thumbnail no chat —
      // tem de vir legível, por isso a 1ª slide não tem fade-in a partir de preto.
      const fadeIn = i === 0 ? 0 : 0.35;
      const args = imageToSegmentArgs({ imagePath: pngPath, durationSec: duration, outPath: segPath, fadeIn });
      await execFileAsync("ffmpeg", args);
      segmentPaths.push(segPath);
    }

    const listFile = path.join(tmpDir, "list.txt");
    fs.writeFileSync(listFile, segmentPaths.map((p) => `file '${p}'`).join("\n"));

    await execFileAsync("ffmpeg", concatArgs({ listFilePath: listFile, outPath }));

    const stat = fs.statSync(outPath);
    return { path: outPath, bytes: stat.size, durationSec: slides.reduce((s, x) => s + x.duration, 0) };
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
}

module.exports = { buildBaseVideo, buildSlidesFromConfig };
