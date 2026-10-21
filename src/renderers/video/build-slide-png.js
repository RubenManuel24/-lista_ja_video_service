/**
 * src/renderers/video/build-slide-png.js
 *
 * Cada "slide" do teaser é gerado como SVG (texto + formas vectoriais,
 * sem dependência de assets externos) e rasterizado para PNG via sharp.
 * O mesmo princípio de "dados, não hardcode" da Fase 1 aplica-se aqui:
 * cores e textos vêm do InviteConfig, nunca fixos no código.
 */

const sharp = require("sharp");

const W = 1080;
const H = 1920;

function escapeXml(str = "") {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

/**
 * @param {{title:string, subtitle?:string, lines?:string[], colors:{primary:string,background:string,text:string}}} spec
 */
function slideSvg(spec) {
  const { title, subtitle, lines = [], colors } = spec;
  const lineY = 1120;
  const linesSvg = lines
    .map(
      (line, i) => `<text x="${W / 2}" y="${lineY + i * 64}" text-anchor="middle"
        font-family="Georgia, serif" font-size="34" fill="${colors.text}">${escapeXml(line)}</text>`
    )
    .join("\n");

  return `
<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <radialGradient id="bg" cx="50%" cy="35%" r="75%">
      <stop offset="0%" stop-color="${colors.background}"/>
      <stop offset="100%" stop-color="${shade(colors.background, -12)}"/>
    </radialGradient>
  </defs>
  <rect width="${W}" height="${H}" fill="url(#bg)"/>

  <!-- moldura ornamental discreta -->
  <rect x="60" y="120" width="${W - 120}" height="${H - 240}" fill="none"
        stroke="${colors.primary}" stroke-opacity="0.25" stroke-width="2"/>

  <path d="M ${W / 2 - 90} 760 C ${W / 2 - 30} 700, ${W / 2 + 30} 820, ${W / 2 + 90} 760"
        stroke="${colors.primary}" stroke-width="2" fill="none" opacity="0.6"/>

  <text x="${W / 2}" y="920" text-anchor="middle"
        font-family="Georgia, serif" font-style="italic" font-weight="700"
        font-size="88" fill="${colors.primary}">${escapeXml(title)}</text>

  ${subtitle ? `<text x="${W / 2}" y="1000" text-anchor="middle"
        font-family="-apple-system, sans-serif" font-size="36" letter-spacing="4"
        fill="${colors.text}" opacity="0.75">${escapeXml(subtitle.toUpperCase())}</text>` : ""}

  ${linesSvg}

  <text x="${W / 2}" y="${H - 90}" text-anchor="middle"
        font-family="-apple-system, sans-serif" font-size="24"
        fill="${colors.text}" opacity="0.45">Feito com Lista Já</text>
</svg>`;
}

/** Escurece/aclara uma cor hex por uma percentagem (-100..100). */
function shade(hex, percent) {
  const num = parseInt(hex.replace("#", ""), 16);
  const amt = Math.round(2.55 * percent);
  const r = Math.min(255, Math.max(0, (num >> 16) + amt));
  const g = Math.min(255, Math.max(0, ((num >> 8) & 0x00ff) + amt));
  const b = Math.min(255, Math.max(0, (num & 0x0000ff) + amt));
  return `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1)}`;
}

async function renderSlidePng(spec) {
  const svg = slideSvg(spec);
  const base = sharp(Buffer.from(svg)).png();
  const layers = [];
  if (spec.art) {
    layers.push({ input: spec.art.tl, left: 0, top: 120 });
    layers.push({ input: spec.art.br, left: W - 400, top: H - 120 - 400 });
  }
  // foto oval (360x450) acima do título, centrada
  if (spec.photo) layers.push({ input: spec.photo, left: Math.round((W - 360) / 2), top: 230 });
  if (!layers.length) return base.toBuffer();
  const png = await base.toBuffer();
  return sharp(png).composite(layers).png().toBuffer();
}

module.exports = { renderSlidePng, W, H };
