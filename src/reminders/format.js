/**
 * src/reminders/format.js
 * Lógica pura (testável) do texto do lembrete diário.
 */
const DAY_MS = 86400000;

// Dias de calendário em Luanda (UTC+1, sem DST) entre "agora" e o evento.
function daysUntil(eventDateIso, now = new Date()) {
  const tz = 3600000;
  const startOfDay = (d) => Math.floor((d.getTime() + tz) / DAY_MS);
  return startOfDay(new Date(eventDateIso)) - startOfDay(now);
}

function reminderMessage(title, eventDateIso, now = new Date()) {
  const n = daysUntil(eventDateIso, now);
  if (n < 0) return null; // evento já passou: não enviar
  if (n === 0) return { n, title, body: `Hoje é o grande dia: ${title}! 🎉` };
  if (n === 1) return { n, title, body: `Falta 1 dia para ${title}.` };
  return { n, title, body: `Faltam ${n} dias para ${title}.` };
}

module.exports = { daysUntil, reminderMessage };
