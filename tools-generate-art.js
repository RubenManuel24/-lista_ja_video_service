/**
 * art/generate.js — gerador de arte ORIGINAL dos modelos (flores, folhas,
 * molduras). Tudo é desenhado por código (SVG procedural com sementes
 * fixas), sem nenhuma imagem de terceiros: não há licenças a respeitar.
 * Saída por modelo: corner_tl / corner_br em PNG (app e renderizadores) e
 * WebP (convite web), com fundo transparente.
 *
 * Uso: node generate.js <pasta-de-saída> [id-do-modelo]
 */
const fs = require("fs");
const path = require("path");
const sharp = require(process.env.SHARP_PATH || "sharp");

const S = 1200; // tela do canto

function rng(seed) { // mulberry32
  let a = seed >>> 0;
  return () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
const hash = (s) => [...s].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7);

function shade(hex, pct) {
  const n = parseInt(hex.slice(1), 16), amt = Math.round(2.55 * pct);
  const c = (v) => Math.min(255, Math.max(0, v + amt));
  return "#" + ((1 << 24) + (c(n >> 16) << 16) + (c((n >> 8) & 255) << 8) + c(n & 255)).toString(16).slice(1);
}

let gid = 0;
function grad(defs, c1, c2) { // gradiente radial claro->escuro
  const id = "g" + (gid++);
  defs.push(`<radialGradient id="${id}" cx="50%" cy="85%" r="95%"><stop offset="0" stop-color="${c1}"/><stop offset="1" stop-color="${c2}"/></radialGradient>`);
  return id;
}

const petal = (L, W) => `M0,0 C${-W},${-L * .22} ${-W * .95},${-L * .85} 0,${-L} C${W * .95},${-L * .85} ${W},${-L * .22} 0,0Z`;
const leaf = (L, W) => `M0,0 C${W},${-L * .3} ${W * .8},${-L * .75} 0,${-L} C${-W * .8},${-L * .75} ${-W},${-L * .3} 0,0Z`;

function rose(defs, r, size, c1, c2, layers = 5, wide = 0.55) {
  const out = [];
  const stroke = shade(c2, -14);
  for (let l = 0; l < layers; l++) {
    const n = 5 + l % 2, k = 1 - l * (0.72 / layers), rot = l * 31 + r() * 20;
    const g = grad(defs, shade(c1, 12 - l * 3), shade(c2, -l * 4));
    for (let i = 0; i < n; i++) {
      const a = rot + (360 / n) * i + (r() - .5) * 14;
      const L = size * k * (0.9 + r() * .2);
      out.push(`<path transform="rotate(${a})" d="${petal(L, L * wide)}" fill="url(#${g})" stroke="${stroke}" stroke-opacity=".35" stroke-width="1.6"/>`);
    }
  }
  const gc = grad(defs, shade(c1, 22), c1);
  out.push(`<circle r="${size * .1}" fill="url(#${gc})"/>`);
  out.push(`<path d="M${-size * .07},0 a${size * .07},${size * .07} 0 1,1 ${size * .14},0" fill="none" stroke="${stroke}" stroke-opacity=".5" stroke-width="2"/>`);
  return out.join("");
}

function leafShape(defs, r, L, c1, c2) {
  const g = grad(defs, c1, c2);
  const W = L * .26;
  return `<path d="${leaf(L, W)}" fill="url(#${g})" stroke="${shade(c2, -18)}" stroke-opacity=".4" stroke-width="1.4"/>` +
    `<path d="M0,0 L0,${-L * .92}" stroke="${shade(c2, -22)}" stroke-opacity=".45" stroke-width="1.6"/>`;
}

function branch(defs, r, x, y, angle, len, c1, c2, leafSize, count) {
  const out = [`<g transform="translate(${x},${y}) rotate(${angle})">`];
  out.push(`<path d="M0,0 Q${len * .1},${-len * .5} ${-len * .05},${-len}" fill="none" stroke="${shade(c2, -10)}" stroke-width="5" stroke-linecap="round" opacity=".85"/>`);
  for (let i = 1; i <= count; i++) {
    const t = i / (count + 1), py = -len * t, px = len * .1 * Math.sin(t * Math.PI) * (1 - t);
    const side = i % 2 ? 1 : -1;
    out.push(`<g transform="translate(${px},${py}) rotate(${side * (48 + r() * 20)}) scale(${1 - t * .35})">${leafShape(defs, r, leafSize * (.85 + r() * .3), c1, c2)}</g>`);
  }
  out.push(`<g transform="translate(${-len * .05},${-len}) rotate(${(r() - .5) * 20})">${leafShape(defs, r, leafSize * .8, c1, c2)}</g>`);
  out.push("</g>");
  return out.join("");
}

function eucalyptus(defs, r, x, y, angle, len, c1, c2) {
  const out = [`<g transform="translate(${x},${y}) rotate(${angle})">`];
  out.push(`<path d="M0,0 Q${len * .15},${-len * .5} ${-len * .1},${-len}" fill="none" stroke="${shade(c2, -12)}" stroke-width="4" stroke-linecap="round"/>`);
  for (let i = 1; i < 10; i++) {
    const t = i / 10, py = -len * t, px = len * .15 * Math.sin(t * Math.PI) * (1 - t) - 0;
    [-1, 1].forEach((s) => {
      const g = grad(defs, c1, c2), rr = 22 + r() * 16 - t * 8;
      out.push(`<ellipse cx="${px + s * rr * .9}" cy="${py + (r() - .5) * 10}" rx="${rr}" ry="${rr * .9}" fill="url(#${g})" opacity=".92" stroke="${shade(c2, -15)}" stroke-opacity=".3"/>`);
    });
  }
  out.push("</g>");
  return out.join("");
}

function berries(defs, r, x, y, c, n) {
  const g = grad(defs, shade(c, 20), c); const out = [];
  for (let i = 0; i < n; i++) out.push(`<circle cx="${x + (r() - .5) * 120}" cy="${y + (r() - .5) * 120}" r="${7 + r() * 8}" fill="url(#${g})"/>`);
  return out.join("");
}

// ---------------------------------------------------------------- estilos --
function floralCorner(p, seed) {
  const r = rng(seed), defs = [], body = [];
  // folhagem ao fundo
  [[40, 330, 150, 380], [150, 200, 120, 340], [30, 520, 165, 320], [260, 60, 110, 320], [90, 90, 135, 400]].forEach(([x, y, a, len]) => {
    body.push(p.eucalyptus
      ? eucalyptus(defs, r, x, y, a + (r() - .5) * 20, len, p.leaves[0], p.leaves[1])
      : branch(defs, r, x, y, a, len, p.leaves[0], p.leaves[1], 120, 5));
  });
  body.push(branch(defs, r, 60, 40, 140, 520, p.leaves[0], p.leaves[1], 110, 6));
  body.push(branch(defs, r, 40, 60, 95, 500, p.leaves[0], p.leaves[1], 105, 6));
  // flores
  const flowers = [[250, 250, 215], [520, 120, 150], [120, 520, 160], [380, 430, 110], [90, 330, 90]];
  flowers.forEach(([x, y, size], i) => {
    const c = p.flowers[i % p.flowers.length], c2 = p.flowers[(i + 1) % p.flowers.length];
    body.push(`<g transform="translate(${x},${y}) rotate(${r() * 360})">${rose(defs, r, size, shade(c, 10), c2, p.layers || 5, p.wide || .55)}</g>`);
  });
  body.push(berries(defs, r, 560, 330, p.accent, 7), berries(defs, r, 330, 600, p.accent, 7));
  return svg(defs, body, 760);
}

function decoCorner(p) {
  const defs = [], b = [], c = p.accent;
  for (let i = 1; i <= 6; i++) {
    const R = 110 * i;
    b.push(`<path d="M${R},0 A${R},${R} 0 0,1 0,${R}" fill="none" stroke="${c}" stroke-width="${i % 2 ? 3 : 7}" opacity="${1 - i * .1}"/>`);
  }
  for (let a = 0; a <= 90; a += 15) {
    const rad = (a * Math.PI) / 180;
    b.push(`<line x1="0" y1="0" x2="${Math.cos(rad) * 560}" y2="${Math.sin(rad) * 560}" stroke="${c}" stroke-width="2" opacity=".55"/>`);
  }
  [[170, 170], [330, 330], [450, 150], [150, 450]].forEach(([x, y]) => {
    b.push(`<rect x="${x - 20}" y="${y - 20}" width="40" height="40" transform="rotate(45 ${x} ${y})" fill="${p.flowers[0]}" stroke="${c}" stroke-width="3"/>`);
  });
  return svg(defs, b, 700);
}

function partyCorner(p, seed, bunting = true) {
  const r = rng(seed), defs = [], b = [];
  // bandeirinhas ao longo do topo, a descair
  const cols = p.flowers.concat([p.accent, p.leaves[0]]);
  for (let i = 0; bunting && i < 9; i++) {
    const x = 40 + i * 120, y = 20 + Math.sin(i * .9) * 18;
    b.push(`<path d="M${x},${y} L${x + 100},${y + 8} L${x + 52},${y + 150}Z" fill="${cols[i % cols.length]}" stroke="${shade(cols[i % cols.length], -20)}" stroke-opacity=".3" stroke-width="2"/>`);
  }
  if (bunting) b.push(`<path d="M0,30 Q600,70 1200,20" fill="none" stroke="${shade(p.accent, -15)}" stroke-width="4"/>`);
  for (let i = 0; i < 70; i++) {
    const x = r() * 900, y = 60 + r() * 700, c = cols[(r() * cols.length) | 0], s = 8 + r() * 14;
    b.push(r() > .5
      ? `<circle cx="${x}" cy="${y}" r="${s / 2}" fill="${c}" opacity=".85"/>`
      : `<rect x="${x}" y="${y}" width="${s * 1.6}" height="${s / 2}" rx="3" fill="${c}" opacity=".85" transform="rotate(${r() * 180} ${x} ${y})"/>`);
  }
  return svg(defs, b, 900);
}

function twigCorner(p, seed) {
  const r = rng(seed), defs = [], b = [];
  [[60, 60, 125, 620], [40, 90, 98, 560], [90, 40, 160, 520]].forEach(([x, y, a, len]) =>
    b.push(branch(defs, r, x, y, a, len, p.leaves[0], p.leaves[1], 95, 8)));
  b.push(berries(defs, r, 260, 300, p.accent, 10), berries(defs, r, 420, 160, p.accent, 8));
  for (let i = 0; i < 6; i++) {
    const g = grad(defs, shade(p.flowers[0], 8), p.flowers[1]);
    b.push(`<g transform="translate(${150 + r() * 380},${150 + r() * 380}) rotate(${r() * 360})"><path d="${petal(55, 26)}" fill="url(#${g})" opacity=".9"/></g>`);
  }
  return svg(defs, b, 720);
}

function bracketCorner(p) {
  const c = p.accent;
  return svg([], [
    `<path d="M60,420 L60,60 L420,60" fill="none" stroke="${c}" stroke-width="7" stroke-linecap="square"/>`,
    `<path d="M110,330 L110,110 L330,110" fill="none" stroke="${c}" stroke-width="3" stroke-linecap="square" opacity=".7"/>`,
    `<circle cx="60" cy="60" r="16" fill="${c}"/>`,
  ], 480);
}

function svg(defs, body, vb = S) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${S}" height="${S}" viewBox="0 0 ${vb} ${vb}"><defs>${defs.join("")}</defs>${body.join("")}</svg>`;
}

// ------------------------------------------------- paletas por modelo ------
const ART = {
  "cas-rosas-douradas": { kind: "floral", flowers: ["#F6EAD3", "#E7CF9E"], leaves: ["#D9B96A", "#A8832F"], accent: "#C9A24B" },
  "cas-folhas-verdes": { kind: "floral", eucalyptus: true, flowers: ["#FFFFFF", "#EEF1E4"], leaves: ["#8DB596", "#4F7A5A"], accent: "#C9A24B", layers: 4 },
  "cas-aguarela-rosa": { kind: "floral", flowers: ["#F7C9D3", "#E58FA5"], leaves: ["#9DC2A0", "#5E8F67"], accent: "#E58FA5" },
  "cas-peonias-vinho": { kind: "floral", flowers: ["#B8475C", "#7A2E3A"], leaves: ["#7FA283", "#46694C"], accent: "#C9A24B", layers: 6, wide: .65 },
  "cas-azul-real": { kind: "deco", flowers: ["#1F3A5F"], accent: "#B8A06A" },
  "cas-linho-madeira": { kind: "twig", flowers: ["#E9D9B7", "#CDB68A"], leaves: ["#A8B98A", "#6F7F52"], accent: "#8A6A3F" },
  "cas-minimal-branco": { kind: "bracket", accent: "#2F4B63" },
  "ani-festa-colorida": { kind: "party", flowers: ["#D9467A", "#F2A33A", "#3C9FD9"], leaves: ["#6CC08B"], accent: "#8E5BD1" },
  "ani-dourado-chic": { kind: "deco", flowers: ["#E6CC8A"], accent: "#D6B25E" },
  "ani-azul-simples": { kind: "bracket", accent: "#2E6FA3" },
  "eve-executivo": { kind: "deco", flowers: ["#3C7DD9"], accent: "#1F3A5F" },
  "noi-rosa-champanhe": { kind: "floral", flowers: ["#F9DDE2", "#EDAFBC"], leaves: ["#C9B27A", "#9A8142"], accent: "#D9A5B1" },
  "noi-azul-noite": { kind: "deco", flowers: ["#22345A"], accent: "#C9A24B" },
  "bat-azul-celeste": { kind: "floral", flowers: ["#FFFFFF", "#CFE3F3"], leaves: ["#A9C9B0", "#6F9A7A"], accent: "#8FB8D8", layers: 4 },
  "bat-branco-dourado": { kind: "bracket", accent: "#B8923F" },
  "cha-menina": { kind: "party", flowers: ["#F4A6BC", "#F9D2DC", "#FFD27A"], leaves: ["#BFE0C6"], accent: "#E58FA5" },
  "cha-menino": { kind: "party", flowers: ["#8FC1E8", "#CFE6F7", "#FFD27A"], leaves: ["#BFE0C6"], accent: "#5B9BD1" },
  "cha-neutro": { kind: "twig", flowers: ["#F1E6CF", "#DCC9A0"], leaves: ["#B9CBA0", "#7C9267"], accent: "#A58B55" },
  "for-azul-dourado": { kind: "deco", flowers: ["#1F3A5F"], accent: "#D6B25E" },
  "for-preto-dourado": { kind: "deco", flowers: ["#D6B25E"], accent: "#8C7230" },
  "pal-moderno": { kind: "bracket", accent: "#1F6F78" },
  "pal-tecnologia": { kind: "deco", flowers: ["#2BA6B5"], accent: "#12303A" },
  "eve-gala-vinho": { kind: "floral", flowers: ["#9E3447", "#6E1F2E"], leaves: ["#8EAE90", "#4D6E53"], accent: "#C9A24B", layers: 5, wide: .6 },
};

const p0 = (id) => ART[id].kind;
function build(id, br = false) {
  const p = ART[id], seed = hash(id);
  switch (p.kind) {
    case "floral": return floralCorner(p, seed);
    case "deco": return decoCorner(p);
    case "party": return partyCorner(p, seed, !br);
    case "twig": return twigCorner(p, seed);
    default: return bracketCorner(p);
  }
}

async function main() {
  const out = process.argv[2] || "out", only = process.argv[3];
  const ids = only ? [only] : Object.keys(ART);
  for (const id of ids) {
    const dir = path.join(out, id); fs.mkdirSync(dir, { recursive: true });
    const base = sharp(Buffer.from(build(id)), { density: 96 });
    const png = await base.clone().resize(560, 560).png({ compressionLevel: 9 }).toBuffer();
    const webp = await base.clone().resize(480, 480).webp({ quality: 82, alphaQuality: 90 }).toBuffer();
    const brBase = p0(id) === "party" ? sharp(Buffer.from(build(id, true)), { density: 96 }) : null;
    const rot = (buf, fmt) => sharp(buf).rotate(180)[fmt](fmt === "png" ? { compressionLevel: 9 } : { quality: 82, alphaQuality: 90 }).toBuffer();
    fs.writeFileSync(path.join(dir, "corner_tl.png"), png);
    const pngBr = brBase ? await brBase.clone().resize(560, 560).png({ compressionLevel: 9 }).toBuffer() : png;
    const webpBr = brBase ? await brBase.clone().resize(480, 480).webp({ quality: 82, alphaQuality: 90 }).toBuffer() : webp;
    fs.writeFileSync(path.join(dir, "corner_br.png"), await rot(pngBr, "png"));
    fs.writeFileSync(path.join(dir, "corner_tl.webp"), webp);
    fs.writeFileSync(path.join(dir, "corner_br.webp"), await rot(webpBr, "webp"));
  }
  console.log("gerados:", ids.length);
}
main().catch((e) => { console.error(e); process.exit(1); });
