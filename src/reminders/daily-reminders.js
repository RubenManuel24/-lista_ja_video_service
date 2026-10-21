/**
 * src/reminders/daily-reminders.js
 *
 * Envia, uma vez por dia (09:00 em Luanda), a notificação push web
 * "Faltam N dias" aos convidados que carregaram em "Lembrar-me" no convite.
 *
 * Variáveis de ambiente:
 *   SUPABASE_URL, SUPABASE_SERVICE_KEY  (service_role — NUNCA no app/site)
 *   VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT (mailto:...)
 *   INVITE_BASE_URL  (ex.: https://convites.exemplo.com)
 * Sem estas variáveis o job fica desligado (não rebenta o worker).
 */
const webpush = require("web-push");
const { reminderMessage } = require("./format");

const SEND_HOUR_LUANDA = 9;

async function sb(path, init = {}) {
  const url = `${process.env.SUPABASE_URL}/rest/v1/${path}`;
  const res = await fetch(url, {
    ...init,
    headers: {
      apikey: process.env.SUPABASE_SERVICE_KEY,
      Authorization: `Bearer ${process.env.SUPABASE_SERVICE_KEY}`,
      "Content-Type": "application/json",
      ...(init.headers || {}),
    },
  });
  if (!res.ok) throw new Error(`Supabase ${res.status} em ${path}: ${await res.text()}`);
  const text = await res.text();
  return text ? JSON.parse(text) : null;
}

async function runOnce(now = new Date()) {
  const today = new Date(now.getTime() + 3600000).toISOString().slice(0, 10);
  const rows = await sb(
    "push_subscriptions?select=id,subscription,last_sent_on," +
      "guests(name,share_status,token_revoked,invite_token,events(title,event_date))"
  );
  let sent = 0;
  for (const r of rows) {
    const g = r.guests;
    if (!g || g.token_revoked || g.share_status === "recusado") continue;
    if (r.last_sent_on === today) continue;
    const msg = reminderMessage(g.events.title, g.events.event_date, now);
    if (!msg) continue;
    try {
      await webpush.sendNotification(
        r.subscription,
        JSON.stringify({
          title: msg.title,
          body: msg.body,
          url: `${process.env.INVITE_BASE_URL || ""}/i/${g.invite_token}`,
        })
      );
      await sb(`push_subscriptions?id=eq.${r.id}`, {
        method: "PATCH",
        body: JSON.stringify({ last_sent_on: today }),
      });
      sent++;
    } catch (err) {
      if (err.statusCode === 404 || err.statusCode === 410) {
        await sb(`push_subscriptions?id=eq.${r.id}`, { method: "DELETE" }); // subscrição expirada
      } else {
        console.error("[reminders] falha a enviar", r.id, err.message);
      }
    }
  }
  return sent;
}

function start() {
  const need = ["SUPABASE_URL", "SUPABASE_SERVICE_KEY", "VAPID_PUBLIC_KEY", "VAPID_PRIVATE_KEY"];
  if (need.some((k) => !process.env[k])) {
    console.log("[reminders] desligado (faltam variáveis de ambiente)");
    return;
  }
  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT || "mailto:listaja@gmail.com",
    process.env.VAPID_PUBLIC_KEY,
    process.env.VAPID_PRIVATE_KEY
  );
  const tick = async () => {
    const lunda = new Date(Date.now() + 3600000);
    if (lunda.getUTCHours() < SEND_HOUR_LUANDA) return; // só depois das 09:00 (hora de Luanda)
    try {
      const n = await runOnce();
      if (n) console.log(`[reminders] ${n} lembretes enviados`);
    } catch (err) {
      console.error("[reminders]", err.message);
    }
  };
  tick();
  setInterval(tick, 30 * 60 * 1000); // verifica de 30 em 30 min; last_sent_on evita duplicados
  console.log("[reminders] activo (diário, 09:00 Luanda)");
}

module.exports = { start, runOnce };
