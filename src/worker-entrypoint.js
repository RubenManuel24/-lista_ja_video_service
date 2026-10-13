/**
 * src/worker-entrypoint.js
 * Processo separado da API (como pede a Fase 1: "independente do app" e
 * escalável à parte). Em produção corre num container próprio.
 */
require("./queue/workers/video.worker");
require("./queue/workers/static.worker");
console.log("[workers] video, overlay, pdf e image workers activos");
