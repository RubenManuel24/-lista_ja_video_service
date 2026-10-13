/**
 * src/cache/render-cache.js
 *
 * Implementa a regra da Fase 0/1: "se o InviteConfig não mudou, não voltes
 * a renderizar". A chave de cache do vídeo-base é o hash do InviteConfig;
 * a do overlay (Opção B) é hash(config) + nome normalizado, para que dois
 * convidados com o mesmo primeiro nome reaproveitem o mesmo ficheiro.
 *
 * v1: cache em Postgres/tabela render_jobs (ver Fase 1). Aqui, para correr
 * localmente, uso um ficheiro JSON como "tabela" — a interface (get/set)
 * é a mesma que a versão com Postgres usaria.
 */

const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const DB_FILE = process.env.RENDER_CACHE_DB || path.join(__dirname, "..", "..", "render-output", "render-cache.json");

function readDb() {
  if (!fs.existsSync(DB_FILE)) return {};
  return JSON.parse(fs.readFileSync(DB_FILE, "utf-8"));
}

function writeDb(db) {
  fs.mkdirSync(path.dirname(DB_FILE), { recursive: true });
  fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2));
}

/** Hash estável do InviteConfig — ignora ordem de chaves. */
function hashConfig(config) {
  const stable = JSON.stringify(sortKeysDeep(config));
  return crypto.createHash("sha256").update(stable).digest("hex").slice(0, 16);
}

function sortKeysDeep(value) {
  if (Array.isArray(value)) return value.map(sortKeysDeep);
  if (value && typeof value === "object") {
    return Object.keys(value)
      .sort()
      .reduce((acc, key) => {
        acc[key] = sortKeysDeep(value[key]);
        return acc;
      }, {});
  }
  return value;
}

function normalizeGuestName(name) {
  return name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // remove acentos p/ cache estável
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "_");
}

/** cache_key igual ao schema da tabela render_jobs da Fase 1. */
function cacheKey({ configHash, kind, guestName }) {
  if (guestName) return `${configHash}:${kind}:${normalizeGuestName(guestName)}`;
  return `${configHash}:${kind}`;
}

async function get(key) {
  const db = readDb();
  return db[key] || null;
}

async function set(key, record) {
  const db = readDb();
  db[key] = { ...record, cachedAt: new Date().toISOString() };
  writeDb(db);
  return db[key];
}

module.exports = { hashConfig, normalizeGuestName, cacheKey, get, set };
