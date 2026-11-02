const GOAL_DEADLINE_NOTICES = new Map([
  [7, 'email_vencimiento_7d_sent'],
  [3, 'email_vencimiento_3d_sent'],
  [1, 'email_vencimiento_1d_sent'],
  [0, 'email_vencimiento_hoy_sent']
]);

function dateKeyInBogota(date) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Bogota',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map(({ type, value }) => [type, value]));
  return `${values.year}-${values.month}-${values.day}`;
}

export function getGoalDeadlineNotice(fechaLimite, now = new Date()) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(fechaLimite || ''))) return null;
  const deadline = new Date(`${fechaLimite}T00:00:00Z`);
  if (Number.isNaN(deadline.getTime()) || deadline.toISOString().slice(0, 10) !== fechaLimite) return null;

  const today = new Date(`${dateKeyInBogota(now)}T00:00:00Z`);
  const daysRemaining = Math.round((deadline.getTime() - today.getTime()) / 86400000);
  const flag = GOAL_DEADLINE_NOTICES.get(daysRemaining);
  return flag ? { daysRemaining, flag } : null;
}
