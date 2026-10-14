import cron from 'node-cron';
import { supabase } from '../database/supabase.js';
import { sendNotificationEmail } from './event-notifications.service.js';
import { getPrefs } from './notification-prefs.service.js';

export const formatCOP = (value) => new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(Number(value) || 0);

const BUDGET_THRESHOLDS = [
  { pct: 100, subject: 'Superaste tu presupuesto mensual', lead: 'Superaste el 100% de tu presupuesto mensual' },
  { pct: 80, subject: 'Estás cerca de tu presupuesto mensual', lead: 'Ya usaste el 80% de tu presupuesto mensual' }
];

// Avisa solo cuando el gasto recién registrado cruza el 80% o el 100% del presupuesto.
export async function checkBudgetAlert(usuario, transaccion) {
  try {
    if (String(transaccion.tipo).toLowerCase() !== 'gasto') return;
    const prefs = await getPrefs(usuario.auth_id);
    if (!prefs.gastos || !prefs.presupuesto) return;

    const mes = String(transaccion.fecha || new Date().toISOString()).slice(0, 7);
    const { data, error } = await supabase
      .from('transacciones')
      .select('monto')
      .eq('usuario_id', usuario.id)
      .eq('tipo', 'gasto')
      .gte('fecha', `${mes}-01`)
      .lte('fecha', `${mes}-31`);
    if (error) throw error;

    const despues = (data || []).reduce((sum, item) => sum + Number(item.monto || 0), 0);
    const antes = despues - Number(transaccion.monto || 0);
    const umbral = BUDGET_THRESHOLDS.find(({ pct }) => {
      const limite = prefs.presupuesto * (pct / 100);
      return antes < limite && despues >= limite;
    });
    if (!umbral) return;

    await sendNotificationEmail({
      to: usuario.email,
      subject: umbral.subject,
      text: `Hola ${usuario.nombre || ''},\n\n${umbral.lead}.\nGastado este mes: ${formatCOP(despues)}\nPresupuesto: ${formatCOP(prefs.presupuesto)}\n\nRevisa tus gastos en Notaire.`
    });
  } catch (error) {
    console.error('Error evaluando alerta de presupuesto:', error.message);
  }
}

async function enviarResumenSemanal() {
  const desde = new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10);
  const { data: usuarios, error } = await supabase
    .from('usuarios')
    .select('id, auth_id, email, nombre')
    .not('auth_id', 'is', null)
    .limit(1000);
  if (error) throw error;

  for (const usuario of usuarios || []) {
    if (!usuario.email) continue;
    const prefs = await getPrefs(usuario.auth_id);
    if (!prefs.semanal) continue;

    const [{ data: movimientos }, { data: metas }] = await Promise.all([
      supabase.from('transacciones').select('tipo, monto').eq('usuario_id', usuario.id).gte('fecha', desde),
      supabase.from('metas').select('monto_actual').eq('usuario_id', usuario.id)
    ]);
    const suma = (tipo) => (movimientos || []).filter(m => m.tipo === tipo).reduce((s, m) => s + Number(m.monto || 0), 0);
    const ahorrado = (metas || []).reduce((s, m) => s + Number(m.monto_actual || 0), 0);

    await sendNotificationEmail({
      to: usuario.email,
      subject: 'Tu resumen semanal',
      text: `Hola ${usuario.nombre || ''},\n\nEste fue tu resumen de los últimos 7 días:\nIngresos: ${formatCOP(suma('ingreso'))}\nGastos: ${formatCOP(suma('gasto'))}\nTotal ahorrado en metas: ${formatCOP(ahorrado)}\n\nIngresa a Notaire para ver el detalle.`
    });
  }
}

export function startWeeklySummaryScheduler() {
  cron.schedule('0 8 * * 1', async () => {
    try {
      await enviarResumenSemanal();
    } catch (error) {
      console.error('Error enviando resumen semanal:', error.message);
    }
  });
}
