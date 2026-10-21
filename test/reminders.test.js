const test = require("node:test");
const assert = require("node:assert");
const { daysUntil, reminderMessage } = require("../src/reminders/format");

const ev = "2026-12-12T15:00:00+01:00";
test("faltam 2 dias", () => {
  const m = reminderMessage("Casamento", ev, new Date("2026-12-10T09:00:00+01:00"));
  assert.equal(m.n, 2);
  assert.equal(m.body, "Faltam 2 dias para Casamento.");
});
test("falta 1 dia", () => {
  assert.equal(reminderMessage("X", ev, new Date("2026-12-11T09:00:00+01:00")).body, "Falta 1 dia para X.");
});
test("no dia", () => {
  assert.match(reminderMessage("X", ev, new Date("2026-12-12T09:00:00+01:00")).body, /Hoje é o grande dia/);
});
test("depois do evento não envia", () => {
  assert.equal(reminderMessage("X", ev, new Date("2026-12-13T09:00:00+01:00")), null);
});
test("conta dias de calendário em Luanda, não 24h", () => {
  // 23:30 Luanda do dia 10 -> ainda faltam 2 dias de calendário
  assert.equal(daysUntil(ev, new Date("2026-12-10T23:30:00+01:00")), 2);
});
