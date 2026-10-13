# lista_ja_video_service

Serviço Node independente da app, responsável por gerar (a partir do mesmo
`InviteConfig` usado no convite web da Fase 2):

1. **Vídeo teaser MP4** (8-12s, H.264+AAC, 1080×1920) — uma vez por evento.
2. **Overlay de nome do convidado** (Opção B) — concatena um clip curto de
   intro (com o nome) ao vídeo-base já pronto, **sem re-encode** do vídeo
   inteiro.
3. **PDF A5** com QR code, a partir do mesmo config.
4. **PNG 1080×1350** com QR code, idem.

Tudo cacheado por `hash(InviteConfig)` (e `+ nome normalizado` no caso do
overlay) — pedir o mesmo render duas vezes não gera trabalho a mais.

## Arquitectura (ver ARQUITECTURA.md da Fase 1)

```
API (Express) --> BullMQ queues (Redis) --> Workers --> FFmpeg / sharp / pdf-lib
```

A API só enfileira e devolve o `jobId`; quem consome os workers é um
processo Node separado (`start:worker`), como pede a Fase 1 ("independente
do app", escalável à parte).

## Correr localmente

Pré-requisitos: Node 20+, Redis, FFmpeg (`apt install redis-server ffmpeg`).

```bash
npm install

redis-server --daemonize yes

# terminal 1
npm run start:worker

# terminal 2
npm run start:api
```

## Testar manualmente

```bash
# Pedir o vídeo-base + PDF + PNG de um evento
curl -X POST http://127.0.0.1:4000/render-jobs/base \
  -H "Content-Type: application/json" \
  -d "{\"eventId\":\"evt1\",\"lang\":\"pt\",\"config\":$(cat config.example.json)}"
# -> {"jobId":"1","queue":"render-video"}

curl http://127.0.0.1:4000/render-jobs/render-video/1
# -> { "state": "completed", "returnvalue": { "path": "...", "bytes": ... } }

curl -X POST http://127.0.0.1:4000/render-jobs/pdf \
  -H "Content-Type: application/json" \
  -d "{\"eventId\":\"evt1\",\"lang\":\"pt\",\"inviteLink\":\"https://listaja.ao/i/tok123\",\"config\":$(cat config.example.json)}"

curl -X POST http://127.0.0.1:4000/render-jobs/image \
  -H "Content-Type: application/json" \
  -d "{\"eventId\":\"evt1\",\"lang\":\"pt\",\"inviteLink\":\"https://listaja.ao/i/tok123\",\"config\":$(cat config.example.json)}"

# Depois do vídeo-base pronto, pedir o overlay de um convidado (Opção B)
curl -X POST http://127.0.0.1:4000/render-jobs/guest-overlay \
  -H "Content-Type: application/json" \
  -d "{\"eventId\":\"evt1\",\"guestId\":\"g1\",\"guestName\":\"Joana Manuel\",\"lang\":\"pt\", \
       \"baseVideoPath\":\"<path devolvido pelo job do vídeo-base>\",\"config\":$(cat config.example.json)}"
```

Os ficheiros ficam em `render-output/events/<eventId>/...` (ou em
`RENDER_OUTPUT_DIR`, se definida). Troque `LocalStorageClient` por um
cliente Supabase Storage para produção — a interface (`put/exists/resolvePath`)
mantém-se igual.

## O que foi validado nesta fase (com dados reais, não simulados)

- Vídeo-base: H.264/AAC, 1080×1920, 30fps, ~260-330 KB, 8,4-9,8s — dentro do
  limite de 8 MB do WhatsApp e do intervalo de 8-12s pedido.
- **Primeira frame legível** (thumbnail do WhatsApp) — havia um bug em que o
  fade-in inicial deixava a frame 0 preta; corrigido (ver `ffmpeg-args.js`).
- Overlay de nome (Opção B): ~1,5-2,9s por convidado (vs ~10s de um
  re-render completo) — concatenação sem re-encode confirmada via ffprobe
  (mesma resolução/fps/codec nos dois segmentos).
- Cache: pedido repetido do mesmo `InviteConfig` → **0 renders novos**
  (cache hit confirmado em log); pedido repetido do mesmo nome de convidado
  → 37ms (cache hit) vs ~6,6s (render novo).
- PDF A5: 420×595pt, QR code decodificado com sucesso (`pyzbar`) e a
  apontar para o link correcto.
- PNG 1080×1350: QR code igualmente validado.
- **Concorrência**: 4 pedidos de overlay em paralelo processam-se em ~6,6s
  no total (não 4×6,6s) — a fila absorve picos quando o organizador começa
  a partilhar com muitos convidados de uma vez.

## Limitação conhecida (a resolver antes da produção)

Se dois pedidos do **mesmo** convidado chegarem em paralelo antes do
primeiro terminar, ambos vão dar cache-miss e renderizar — o cache só
"tranca" depois de o primeiro job terminar. Para produção, adicionar um
estado `em_processamento` no `render_jobs` (já existe na tabela da Fase 1)
e fazer o segundo pedido aguardar/reencaminhar para o job em curso em vez
de iniciar um novo, usando `job.id` determinístico (`jobId = cacheKey`,
suportado nativamente pelo BullMQ) — é uma mudança pequena, mas prefiro
sinalizar em vez de esconder.
