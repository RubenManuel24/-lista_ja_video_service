/**
 * src/renderers/common/couple-photo.js
 *
 * Foto do casal (opcional) integrada no design SEM IA: recorte inteligente
 * (sharp "attention" — centra no que tem mais detalhe, tipicamente os
 * rostos), máscara oval e anel na cor do tema. Funciona em offline, é
 * gratuito e dá sempre o mesmo resultado para a mesma foto (compatível
 * com a cache por hash do InviteConfig).
 *
 * config.assets.couplePhotoUrl: URL http(s) ou caminho local.
 */

const fs = require("fs");
const sharp = require("sharp");

async function readSource(source) {
  if (/^https?:\/\//i.test(source)) {
    const res = await fetch(source);
    if (!res.ok) throw new Error(`foto do casal: HTTP ${res.status}`);
    return Buffer.from(await res.arrayBuffer());
  }
  return fs.readFileSync(source);
}

/** PNG oval (w x h) com anel de cor `ringColor`. Transparente fora do oval. */
async function ovalPhoto(input, w, h, ringColor) {
  const ring = Math.max(4, Math.round(w * 0.03));
  const iw = w - ring * 2;
  const ih = h - ring * 2;

  const cropped = await sharp(input)
    .rotate() // respeita a orientação EXIF dos telemóveis
    .resize(iw, ih, { fit: "cover", position: sharp.strategy.attention })
    .png()
    .toBuffer();

  const mask = Buffer.from(
    `<svg width="${iw}" height="${ih}"><ellipse cx="${iw / 2}" cy="${ih / 2}" rx="${iw / 2}" ry="${ih / 2}" fill="#fff"/></svg>`
  );
  const ovalInner = await sharp(cropped).composite([{ input: mask, blend: "dest-in" }]).png().toBuffer();

  const ringSvg = Buffer.from(
    `<svg width="${w}" height="${h}"><ellipse cx="${w / 2}" cy="${h / 2}" rx="${w / 2 - ring / 2}" ry="${h / 2 - ring / 2}"
      fill="none" stroke="${ringColor}" stroke-width="${ring}"/></svg>`
  );

  return sharp({ create: { width: w, height: h, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
    .composite([
      { input: ovalInner, left: ring, top: ring },
      { input: ringSvg, left: 0, top: 0 },
    ])
    .png()
    .toBuffer();
}

/**
 * Devolve o PNG oval da foto do casal, ou null se não houver foto ou se
 * ela falhar a carregar (o convite sai na mesma, só sem foto).
 */
async function loadCouplePhoto(config, w, h) {
  const source = config.assets && config.assets.couplePhotoUrl;
  if (!source) return null;
  try {
    const buf = await readSource(source);
    return await ovalPhoto(buf, w, h, config.theme.colors.secondary || config.theme.colors.primary);
  } catch (err) {
    console.error("[couple-photo] ignorada:", err.message);
    return null;
  }
}

module.exports = { loadCouplePhoto, ovalPhoto };
