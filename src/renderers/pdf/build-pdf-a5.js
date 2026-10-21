/**
 * src/renderers/pdf/build-pdf-a5.js
 *
 * PDF A5 (420 x 595 pt em pontos ~ half-A4) com o essencial do convite,
 * o link por extenso e o QR code — para quem prefere/precisa de imprimir.
 */

const { PDFDocument, rgb, StandardFonts } = require("pdf-lib");
const QRCode = require("qrcode");
const { loadCouplePhoto } = require("../common/couple-photo");
const { loadTemplateArt } = require("../common/template-art");

// A5 em pontos (72dpi): 420 x 595
const A5_WIDTH = 420;
const A5_HEIGHT = 595;

function localizedText(field, lang, fallback) {
  if (!field) return fallback || "";
  return field[lang] || field.pt || Object.values(field)[0] || fallback || "";
}

function hexToRgb01(hex) {
  const num = parseInt(hex.replace("#", ""), 16);
  return rgb(((num >> 16) & 255) / 255, ((num >> 8) & 255) / 255, (num & 255) / 255);
}

async function buildPdfA5(config, inviteLink, lang = "pt") {
  const pdf = await PDFDocument.create();
  const page = pdf.addPage([A5_WIDTH, A5_HEIGHT]);

  const fontTitle = await pdf.embedFont(StandardFonts.TimesRomanItalic);
  const fontBody = await pdf.embedFont(StandardFonts.Helvetica);

  const colors = config.theme.colors;
  const photoPng = await loadCouplePhoto(config, 252, 312); // 3x para ficar nítida ao imprimir
  const dy = photoPng ? 70 : 0; // com foto, o texto desce
  const primary = hexToRgb01(colors.primary);
  const text = hexToRgb01(colors.text);

  const art = await loadTemplateArt(config, 520);
  if (art) {
    const tl = await pdf.embedPng(art.tl);
    const br = await pdf.embedPng(art.br);
    const dim = 170;
    page.drawImage(tl, { x: 0, y: A5_HEIGHT - dim, width: dim, height: dim });
    page.drawImage(br, { x: A5_WIDTH - dim, y: 0, width: dim, height: dim });
  }

  page.drawRectangle({
    x: 20, y: 20, width: A5_WIDTH - 40, height: A5_HEIGHT - 40,
    borderColor: primary, borderWidth: 1, opacity: 0, borderOpacity: 0.4,
  });

  const title = localizedText(config.cover.title, lang);
  const titleSize = 30;
  const titleWidth = fontTitle.widthOfTextAtSize(title, titleSize);
  page.drawText(title, {
    x: (A5_WIDTH - titleWidth) / 2, y: A5_HEIGHT - 140 - dy,
    size: titleSize, font: fontTitle, color: primary,
  });

  const subtitle = localizedText(config.cover.subtitle, lang).toUpperCase();
  const subSize = 10;
  const subWidth = fontBody.widthOfTextAtSize(subtitle, subSize);
  page.drawText(subtitle, {
    x: (A5_WIDTH - subWidth) / 2, y: A5_HEIGHT - 165 - dy,
    size: subSize, font: fontBody, color: text,
  });

  const eventDate = new Date(config.cover.eventDate);
  const dateStr = eventDate.toLocaleDateString(lang === "pt" ? "pt-PT" : "en-GB", {
    day: "2-digit", month: "long", year: "numeric",
  });
  const dateWidth = fontBody.widthOfTextAtSize(dateStr, 13);
  page.drawText(dateStr, {
    x: (A5_WIDTH - dateWidth) / 2, y: A5_HEIGHT - 195 - dy,
    size: 13, font: fontBody, color: text,
  });

  const venue = config.venues && config.venues[0];
  if (venue) {
    const venueLine = `${localizedText(venue.name, lang)} · ${venue.location.address}`;
    const vw = fontBody.widthOfTextAtSize(venueLine, 10);
    page.drawText(venueLine, {
      x: (A5_WIDTH - vw) / 2, y: A5_HEIGHT - 220 - dy,
      size: 10, font: fontBody, color: text,
    });
  }

  if (photoPng) {
    const photoImage = await pdf.embedPng(photoPng);
    page.drawImage(photoImage, { x: (A5_WIDTH - 84) / 2, y: A5_HEIGHT - 35 - 104, width: 84, height: 104 });
  }

  // QR code
  const qrPngDataUrl = await QRCode.toDataURL(inviteLink, { margin: 1, width: 300 });
  const qrBytes = Buffer.from(qrPngDataUrl.split(",")[1], "base64");
  const qrImage = await pdf.embedPng(qrBytes);
  const qrDim = 140;
  page.drawImage(qrImage, {
    x: (A5_WIDTH - qrDim) / 2, y: A5_HEIGHT - 420 - dy,
    width: qrDim, height: qrDim,
  });

  const hint = lang === "pt" ? "Aponte a câmara para confirmar presença" : "Scan to RSVP";
  const hintWidth = fontBody.widthOfTextAtSize(hint, 9);
  page.drawText(hint, {
    x: (A5_WIDTH - hintWidth) / 2, y: A5_HEIGHT - 435 - dy,
    size: 9, font: fontBody, color: text,
  });

  const linkWidth = fontBody.widthOfTextAtSize(inviteLink, 8);
  page.drawText(inviteLink, {
    x: Math.max(20, (A5_WIDTH - linkWidth) / 2), y: 60,
    size: 8, font: fontBody, color: primary,
  });

  const footer = "Feito com Lista Já";
  const footerWidth = fontBody.widthOfTextAtSize(footer, 8);
  page.drawText(footer, {
    x: (A5_WIDTH - footerWidth) / 2, y: 36,
    size: 8, font: fontBody, color: text, opacity: 0.6,
  });

  return pdf.save();
}

module.exports = { buildPdfA5, A5_WIDTH, A5_HEIGHT };
