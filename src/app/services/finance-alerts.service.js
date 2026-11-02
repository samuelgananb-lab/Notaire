import cron from 'node-cron';
import { supabase } from '../database/supabase.js';
import { getEmailStatus } from './email.service.js';
import { sendNotificationEmail } from './event-notifications.service.js';
import { getPrefs } from './notification-prefs.service.js';
import { monthDateRange } from './financial-summary.service.js';
import { deliverNotificationOnce } from './notification-delivery.service.js';

export const formatCOP = (value) => new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(Number(value) || 0);

const BUDGET_THRESHOLDS = [
  { pct: 100, subject: 'Superaste tu presupuesto mensual', lead: 'Superaste el 100% de tu presupuesto mensual' },
  { pct: 80, subject: 'Estás cerca de tu presupuesto mensual', lead: 'Ya usaste el 80% de tu presupuesto mensual' }
];

async function deliverBudgetAlert({ usuario, month, threshold, spent, budget }) {
  return deliverNotificationOnce({
    sourceType: 'budget-alert',
    sourceId: usuario.id,
    sourceVersion: month,
    notificationType: `threshold-${threshold.pct}`,
    send: idempotencyKey => sendNotificationEmail({
      to: usuario.email,
      subject: threshold.subject,
      text: `Hola ${usuario.nombre || ''},\n\n${threshold.lead}.\nGastado este mes: ${formatCOP(spent)}\nPresupuesto: ${formatCOP(budget)}\n\nRevisa tus gastos en Notaire.`,
      idempotencyKey
    })
  });
}

function getBogotaDateKey(date = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Bogota',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map(({ type, value }) => [type, value]));
  return `${values.year}-${values.month}-${values.day}`;
}

function getBogotaWeekStart(date = new Date()) {
  const [year, month, day] = getBogotaDateKey(date).split('-').map(Number);
  const weekStart = new Date(Date.UTC(year, month - 1, day));
  weekStart.setUTCDate(weekStart.getUTCDate() - ((weekStart.getUTCDay() + 6) % 7));
  return weekStart.toISOString().slice(0, 10);
}

// Avisa solo cuando el gasto recién registrado cruza el 80% o el 100% del presupuesto.
export async function checkBudgetAlert(usuario, transaccion) {
  try {
    if (String(transaccion.tipo).toLowerCase() !== 'gasto') return;
    const prefs = await getPrefs(usuario.auth_id);
    if (!prefs.email || !prefs.gastos || !prefs.presupuesto) return;

    const mes = String(transaccion.fecha || new Date().toISOString()).slice(0, 7);
    const { start, endExclusive } = monthDateRange(mes);
    const { data, error } = await supabase
      .from('transacciones')
      .select('monto')
      .eq('usuario_id', usuario.id)
      .eq('tipo', 'gasto')
      .gte('fecha', start)
      .lt('fecha', endExclusive);
    if (error) throw error;

    const despues = (data || []).reduce((sum, item) => sum + Number(item.monto || 0), 0);
    const antes = despues - Number(transaccion.monto || 0);
    const umbral = BUDGET_THRESHOLDS.find(({ pct }) => {
      const limite = prefs.presupuesto * (pct / 100);
      return antes < limite && despues >= limite;
    });
    if (!umbral) return;

    await deliverBudgetAlert({
      usuario,
      month: mes,
      threshold: umbral,
      spent: despues,
      budget: prefs.presupuesto
    });
  } catch (error) {
    console.error('Error evaluando alerta de presupuesto:', error.message);
  }
}

export async function processPendingBudgetAlertNotifications() {
  if (!getEmailStatus().ready) return;

  const { data: pending, error } = await supabase
    .from('notification_deliveries')
    .select('source_id, source_version, notification_type')
    .eq('source_type', 'budget-alert')
    .eq('status', 'pending')
    .lte('next_attempt_at', new Date().toISOString())
    .limit(200);
  if (error) throw error;

  for (const delivery of pending || []) {
    const threshold = BUDGET_THRESHOLDS.find(
      item => delivery.notification_type === `threshold-${item.pct}`
    );
    if (!threshold || !/^\d{4}-\d{2}$/.test(delivery.source_version)) continue;

    const { data: usuario, error: userError } = await supabase
      .from('usuarios')
      .select('id, auth_id, email, nombre')
      .eq('id', delivery.source_id)
      .maybeSingle();
    if (userError) throw userError;
    if (!usuario?.email) continue;

    const prefs = await getPrefs(usuario.auth_id);
    if (!prefs.email || !prefs.gastos || !prefs.presupuesto) continue;

    const { start, endExclusive } = monthDateRange(delivery.source_version);
    const { data: expenses, error: expenseError } = await supabase
      .from('transacciones')
      .select('monto')
      .eq('usuario_id', usuario.id)
      .eq('tipo', 'gasto')
      .gte('fecha', start)
      .lt('fecha', endExclusive);
    if (expenseError) throw expenseError;

    const spent = (expenses || []).reduce((sum, item) => sum + Number(item.monto || 0), 0);
    if (spent < prefs.presupuesto * (threshold.pct / 100)) continue;

    await deliverBudgetAlert({
      usuario,
      month: delivery.source_version,
      threshold,
      spent,
      budget: prefs.presupuesto
    });
  }
}

export async function enviarResumenSemanal() {
  if (!getEmailStatus().ready) return;

  const semana = getBogotaWeekStart();
  const desdeDate = new Date(`${getBogotaDateKey()}T00:00:00.000Z`);
  desdeDate.setUTCDate(desdeDate.getUTCDate() - 7);
  const desde = desdeDate.toISOString().slice(0, 10);
  const { data: usuarios, error } = await supabase
    .from('usuarios')
    .select('id, auth_id, email, nombre')
    .not('auth_id', 'is', null)
    .limit(1000);
  if (error) throw error;

  for (const usuario of usuarios || []) {
    if (!usuario.email) continue;
    const prefs = await getPrefs(usuario.auth_id);
    if (!prefs.email || !prefs.semanal) continue;

    const [{ data: movimientos, error: movimientosError }, { data: metas, error: metasError }] = await Promise.all([
      supabase.from('transacciones').select('tipo, monto').eq('usuario_id', usuario.id).gte('fecha', desde),
      supabase.from('metas').select('monto_actual').eq('usuario_id', usuario.id)
    ]);
    if (movimientosError) throw movimientosError;
    if (metasError) throw metasError;
    const suma = (tipo) => (movimientos || []).filter(m => m.tipo === tipo).reduce((s, m) => s + Number(m.monto || 0), 0);
    const ahorrado = (metas || []).reduce((s, m) => s + Number(m.monto_actual || 0), 0);

    const delivery = await deliverNotificationOnce({
      sourceType: 'weekly-summary',
      sourceId: usuario.id,
      sourceVersion: semana,
      notificationType: 'weekly-summary',
      send: idempotencyKey => sendNotificationEmail({
        to: usuario.email,
        subject: 'Tu resumen semanal',
        text: `Hola ${usuario.nombre || ''},\n\nEste fue tu resumen de los últimos 7 días:\nIngresos: ${formatCOP(suma('ingreso'))}\nGastos: ${formatCOP(suma('gasto'))}\nTotal ahorrado en metas: ${formatCOP(ahorrado)}\n\nIngresa a Notaire para ver el detalle.`,
        idempotencyKey
      })
    });
    if (delivery.status === 'not-sent') {
      throw new Error(`Resend no confirmó el resumen semanal del usuario ${usuario.id}.`);
    }
  }
}

export function startWeeklySummaryScheduler() {
  cron.schedule('0 8 * * 1', async () => {
    try {
      await enviarResumenSemanal();
    } catch (error) {
      console.error('Error enviando resumen semanal:', error.message);
    }
  }, { timezone: 'America/Bogota' });
}
