/**
 * src/renderers/common/template-art.js
 *
 * Arte original do modelo (flores, folhas, molduras) gerada por código
 * (tools-generate-art.js) — sem imagens de terceiros. config.assets.artId
 * escolhe a pasta em assets/art/<id>/ (corner_tl.png e corner_br.png).
 * Sem artId ou sem ficheiros, o convite sai sem arte (nunca falha).
 */
const fs = require("fs");
const path = require("path");
const sharp = require("sharp");

const ART_DIR = path.join(__dirname, "..", "..", "..", "assets", "art");

async function loadTemplateArt(config, size) {
  const id = config.assets && config.assets.artId;
  if (!id || !/^[a-z0-9-]+$/.test(id)) return null;
  try {
    const read = (name) =>
      sharp(fs.readFileSync(path.join(ART_DIR, id, name))).resize(size, size).png().toBuffer();
    return { tl: await read("corner_tl.png"), br: await read("corner_br.png") };
  } catch (err) {
    console.error("[template-art] ignorada:", err.message);
    return null;
  }
}

module.exports = { loadTemplateArt };
