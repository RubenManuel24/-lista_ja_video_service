# lista_ja_video_service/Dockerfile
#
# Multi-stage: instala dependências primeiro (cache do Docker separado do
# código, para não reinstalar node_modules a cada alteração de código),
# depois copia só o necessário para a imagem final.

FROM node:20-bookworm-slim AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

FROM node:20-bookworm-slim AS runtime

# FFmpeg (vídeo) e poppler-utils (pré-visualização de PDF). Requisitos nativos desta imagem — a Fase 1 exige render
# server-side, não no dispositivo, e é isto que torna isso possível.
RUN apt-get update && \
    apt-get install -y --no-install-recommends ffmpeg curl poppler-utils && \
    rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Utilizador não-root — boa prática de segurança, especialmente numa
# imagem que processa ficheiros de utilizadores (vídeos/PDFs enviados
# indirectamente através dos InviteConfigs).
RUN useradd --create-home --shell /bin/bash appuser && \
    mkdir -p /app/render-output && \
    chown -R appuser:appuser /app
USER appuser

ENV NODE_ENV=production
ENV RENDER_OUTPUT_DIR=/app/render-output

EXPOSE 4000

# A imagem serve tanto a API como o worker — qual dos dois processos corre
# é decidido pelo comando passado no docker-compose.yml (CMD é só o
# default para quem correr a imagem "à mão" sem especificar).
CMD ["node", "src/api/server.js"]
