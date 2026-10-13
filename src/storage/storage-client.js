/**
 * src/storage/storage-client.js
 *
 * Em produção: Supabase Storage (mesmo bucket que a app usa para servir
 * vídeo/pdf/png ao WebRenderer e à app do organizador). Aqui, para correr
 * localmente sem credenciais externas, guarda em disco sob RENDER_OUTPUT_DIR
 * e devolve um "url" de ficheiro local. A interface é a mesma nos dois casos
 * — trocar a implementação não obriga a mexer nos renderers.
 */

const fs = require("fs");
const path = require("path");

const OUTPUT_DIR = process.env.RENDER_OUTPUT_DIR || path.join(__dirname, "..", "..", "render-output");

if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

class LocalStorageClient {
  /**
   * @param {string} relativePath ex: "events/evt123/video-base.mp4"
   * @param {Buffer} buffer
   * @returns {Promise<{url: string, path: string, bytes: number}>}
   */
  async put(relativePath, buffer) {
    const fullPath = path.join(OUTPUT_DIR, relativePath);
    fs.mkdirSync(path.dirname(fullPath), { recursive: true });
    fs.writeFileSync(fullPath, buffer);
    return {
      url: `file://${fullPath}`,
      path: fullPath,
      bytes: buffer.length,
    };
  }

  async exists(relativePath) {
    return fs.existsSync(path.join(OUTPUT_DIR, relativePath));
  }

  resolvePath(relativePath) {
    return path.join(OUTPUT_DIR, relativePath);
  }
}

module.exports = { LocalStorageClient, OUTPUT_DIR };
