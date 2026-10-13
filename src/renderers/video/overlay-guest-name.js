/**
 * src/renderers/video/overlay-guest-name.js
 *
 * Opção B (decisão registada na Fase 1/2): NÃO volta a renderizar o
 * vídeo inteiro por convidado. Gera apenas um pequeno segmento de
 * intro (1.4s) com "Querido(a) {nome}" codificado com os MESMOS
 * parâmetros do vídeo-base, e concatena por "-c copy" (sem re-encode).
 *
 * Custo real por convidado: 1 render de slide + 1 encode de ~1.4s de
 * vídeo + 1 concat sem re-encode — ordens de magnitude mais barato do
 * que re-renderizar o teaser completo (Opção A).
 */

const fs = require("fs");
const path = require("path");
const os = require("os");
const { execFile } = require("child_process");
const { promisify } = require("util");
const execFileAsync = promisify(execFile);

const { renderSlidePng } = require("./build-slide-png");
const { imageToSegmentArgs, concatArgs } = require("./ffmpeg-args");

function greeting(guestName, lang, colors) {
  const title = lang === "pt" ? `Querido(a)\n${guestName}` : `Dear\n${guestName}`;
  return {
    title: guestName,
    subtitle: lang === "pt" ? "Você está convidado(a)" : "You are invited",
    lines: [],
    colors,
  };
}

/**
 * @param {string} baseVideoPath  vídeo-base já renderizado e cacheado
 * @param {string} guestName
 * @param {object} theme  config.theme (para manter a mesma identidade visual)
 * @param {string} outPath
 * @param {string} lang
 */
async function overlayGuestName({ baseVideoPath, guestName, theme, outPath, lang = "pt" }) {
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "listaja-overlay-"));
  try {
    const introPng = path.join(tmpDir, "intro.png");
    const introSeg = path.join(tmpDir, "intro.mp4");

    const spec = greeting(guestName, lang, theme.colors);
    fs.writeFileSync(introPng, await renderSlidePng(spec));

    await execFileAsync(
      "ffmpeg",
      imageToSegmentArgs({ imagePath: introPng, durationSec: 1.4, outPath: introSeg, fadeIn: 0, fadeOut: 0.25 })
    );

    const listFile = path.join(tmpDir, "list.txt");
    fs.writeFileSync(listFile, [`file '${introSeg}'`, `file '${baseVideoPath}'`].join("\n"));

    await execFileAsync("ffmpeg", concatArgs({ listFilePath: listFile, outPath }));

    const stat = fs.statSync(outPath);
    return { path: outPath, bytes: stat.size };
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
}

module.exports = { overlayGuestName };
