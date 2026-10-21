/**
 * src/renderers/image/build-png-1080x1350.js
 *
 * Convite estático em imagem, com QR code embutido a apontar para o link
 * único do convidado. Gerado a partir do mesmo InviteConfig da Fase 2.
 */

const sharp = require("sharp");
const QRCode = require("qrcode");
const { loadCouplePhoto } = require("../common/couple-photo");
const { loadTemplateArt } = require("../common/template-art");

const W = 1080;
const H = 1350;

function escapeXml(str = "") {
  return String(str).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function localizedText(field, lang, fallback) {
  if (!field) return fallback || "";
  return field[lang] || field.pt || Object.values(field)[0] || fallback || "";
}

async function buildPng1080x1350(config, inviteLink, lang = "pt") {
  const colors = config.theme.colors;
  const eventDate = new Date(config.cover.eventDate);
  const dateStr = eventDate.toLocaleDateString(lang === "pt" ? "pt-PT" : "en-GB", {
    day: "2-digit", month: "long", year: "numeric",
  });
  const venue = config.venues && config.venues[0];

  // Com foto do casal o texto desce 170px e o QR encolhe para caber.
  const photo = await loadCouplePhoto(config, 260, 330);
  const dy = photo ? 170 : 0;
  const qrSize = photo ? 220 : 260;
  const qrTop = photo ? 790 : 640;

  const qrBuffer = await QRCode.toBuffer(inviteLink, { margin: 1, width: qrSize, color: { dark: colors.primary, light: "#FFFFFF00" } });
  const qrBase64 = qrBuffer.toString("base64");

  const svg = `
<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg">
  <rect width="${W}" height="${H}" fill="${colors.background}"/>
  <rect x="48" y="48" width="${W - 96}" height="${H - 96}" fill="none"
        stroke="${colors.primary}" stroke-opacity="0.3" stroke-width="2"/>

  <text x="${W / 2}" y="${360 + dy}" text-anchor="middle" font-family="Georgia, serif"
        font-style="italic" font-weight="700" font-size="72" fill="${colors.primary}">
    ${escapeXml(localizedText(config.cover.title, lang))}
  </text>
  <text x="${W / 2}" y="${420 + dy}" text-anchor="middle" font-family="-apple-system, sans-serif"
        font-size="26" letter-spacing="3" fill="${colors.text}" opacity="0.75">
    ${escapeXml(localizedText(config.cover.subtitle, lang).toUpperCase())}
  </text>
  <text x="${W / 2}" y="${480 + dy}" text-anchor="middle" font-family="Georgia, serif"
        font-size="34" fill="${colors.text}">${escapeXml(dateStr)}</text>

  ${venue ? `<text x="${W / 2}" y="${560 + dy}" text-anchor="middle" font-family="-apple-system, sans-serif"
        font-size="24" fill="${colors.text}" opacity="0.8">${escapeXml(venue.location.address)}</text>` : ""}

  <text x="${W / 2}" y="${980 + (photo ? 70 : 0)}" text-anchor="middle" font-family="-apple-system, sans-serif"
        font-size="22" fill="${colors.text}" opacity="0.7">
    ${lang === "pt" ? "Aponte a câmara para confirmar presença" : "Scan to RSVP"}
  </text>

  <text x="${W / 2}" y="${H - 60}" text-anchor="middle" font-family="-apple-system, sans-serif"
        font-size="18" fill="${colors.text}" opacity="0.45">Feito com Lista Já</text>
</svg>`;

  const base = await sharp(Buffer.from(svg)).png().toBuffer();

  const art = await loadTemplateArt(config, 400);
  const layers = [];
  if (art) {
    layers.push({ input: art.tl, left: 0, top: 0 });
    layers.push({ input: art.br, left: W - 400, top: H - 400 });
  }
  layers.push({ input: qrBuffer, left: Math.round((W - qrSize) / 2), top: qrTop });
  if (photo) layers.push({ input: photo, left: Math.round((W - 260) / 2), top: 100 });

  return sharp(base)
    .composite(layers)
    .png()
    .toBuffer();
}

module.exports = { buildPng1080x1350 };
