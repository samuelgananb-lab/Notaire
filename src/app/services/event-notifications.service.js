import cron from 'node-cron';
import { supabase } from '../database/supabase.js';
import { getPrefs } from './notification-prefs.service.js';
import { getGoalDeadlineNotice } from './goal-notification-rules.js';
import { getEmailStatus, sendAppEmail } from './email.service.js';

let reminderSchemaWarningShown = false;
let goalSchemaWarningShown = false;

function configured() {
  return getEmailStatus().ready;
}

export async function sendNotificationEmail({ to, subject, text }) {
  if (!to) {
    console.warn('Correo omitido: falta el destinatario.');
    return false;
  }

  try {
    return await sendAppEmail({ to, subject, text });
  } catch (error) {
    console.error('Error enviando notificación por correo:', error.message);
    return false;
  }
}

function minutesUntil(evento, now = Date.now()) {
  const target = evento.fecha
    ? new Date(`${evento.fecha}T${String(evento.hora || '08:00').slice(0, 5)}:00-05:00`)
    : new Date(evento.fecha_hora);
  return (target.getTime() - now) / 60000;
}

async function processEventNotifications() {
  if (!configured()) return;

  const { data: eventos, error } = await supabase
    .from('eventos_calendario')
    .select('id, usuario_id, titulo, nota, fecha, hora, fecha_hora, notif24h, notif1h, notifonday, notif24_sent, notif1h_sent, notifonday_sent')
    .eq('estado', 'pendiente')
    .limit(200);

  if (error) throw error;

  for (const evento of eventos || []) {
    const remaining = minutesUntil(evento);
    const aviso = evento.notif24h && !evento.notif24_sent && remaining > 0 && remaining <= 24 * 60
      ? { flag: 'notif24_sent', label: 'mañana' }
      : evento.notif1h && !evento.notif1h_sent && remaining > 0 && remaining <= 60
        ? { flag: 'notif1h_sent', label: 'en una hora' }
        : evento.notifonday && !evento.notifonday_sent && remaining > -5 && remaining <= 1
          ? { flag: 'notifonday_sent', label: 'ahora' }
          : null;

    if (!aviso) continue;

    const { data: usuario, error: userError } = await supabase
      .from('usuarios')
      .select('email, nombre, auth_id')
      .eq('id', evento.usuario_id)
      .single();
    if (userError || !usuario?.email) continue;

    const prefs = await getPrefs(usuario.auth_id);
    const avisoDesactivado = (aviso.flag === 'notif24_sent' && !prefs.h24) ||
      (aviso.flag === 'notif1h_sent' && !prefs.h1);
    if (avisoDesactivado) {
      await supabase.from('eventos_calendario').update({ [aviso.flag]: true }).eq('id', evento.id);
      continue;
    }
    if (!prefs.email) continue;

    const sent = await sendNotificationEmail({
      to: usuario.email,
      subject: `Recordatorio: ${evento.titulo}`,
      text: `Hola ${usuario.nombre || ''},\n\nTienes el evento "${evento.titulo}" ${aviso.label}.\nFecha: ${evento.fecha || 'No especificada'} ${evento.hora || '08:00'}\n${evento.nota || ''}\n\nNotaire`
    });

    if (!sent) continue;

    const { error: updateError } = await supabase
      .from('eventos_calendario')
      .update({ [aviso.flag]: true })
      .eq('id', evento.id);
    if (updateError) console.error('No se pudo marcar el recordatorio enviado:', updateError.message);
  }
}

async function processFinancialReminderNotifications() {
  if (!configured()) return;

  const { data: reminders, error } = await supabase
    .from('recordatorios')
    .select('id, usuario_id, titulo, monto, fecha_vencimiento, estado, email_24h_sent, email_due_sent')
    .eq('estado', 'pendiente')
    .limit(200);

  if (error) {
    if (!reminderSchemaWarningShown && (error.code === '42703' || error.message.includes('email_24h_sent'))) {
      reminderSchemaWarningShown = true;
      console.warn('Aplica src/database/recordatorios_notificaciones_migration.sql para activar avisos de vencimiento financiero.');
      return;
    }
    throw error;
  }

  for (const reminder of reminders || []) {
    const dueAt = new Date(`${String(reminder.fecha_vencimiento).slice(0, 10)}T09:00:00-05:00`);
    const remainingMinutes = (dueAt.getTime() - Date.now()) / 60000;
    const aviso = !reminder.email_24h_sent && remainingMinutes > 0 && remainingMinutes <= 24 * 60
      ? { flag: 'email_24h_sent', subject: 'Compromiso próximo a vencer', when: 'vence dentro de las próximas 24 horas' }
      : !reminder.email_due_sent && remainingMinutes <= 0
        ? { flag: 'email_due_sent', subject: 'Compromiso financiero vencido', when: 'ya llegó a su fecha de vencimiento' }
        : null;

    if (!aviso) continue;

    const { data: usuario, error: userError } = await supabase
      .from('usuarios')
      .select('email, nombre, auth_id')
      .eq('id', reminder.usuario_id)
      .single();
    if (userError || !usuario?.email) continue;

    const prefs = await getPrefs(usuario.auth_id);
    if (!prefs.email) continue;

    const sent = await sendNotificationEmail({
      to: usuario.email,
      subject: aviso.subject,
      text: `Hola ${usuario.nombre || ''},\n\nTu compromiso "${reminder.titulo}" ${aviso.when}.\nMonto: ${new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP' }).format(Number(reminder.monto) || 0)}\nFecha de vencimiento: ${reminder.fecha_vencimiento}\n\nIngresa a Notaire para revisar tus compromisos.`
    });

    if (!sent) continue;

    const { error: updateError } = await supabase
      .from('recordatorios')
      .update({ [aviso.flag]: true })
      .eq('id', reminder.id);
    if (updateError) console.error('No se pudo marcar el aviso financiero enviado:', updateError.message);
  }
}

async function processGoalDeadlineNotifications() {
  if (!configured()) return;

  const { data: metas, error } = await supabase
    .from('metas')
    .select('id, usuario_id, nombre, monto_objetivo, monto_actual, fecha_limite, email_vencimiento_7d_sent, email_vencimiento_3d_sent, email_vencimiento_1d_sent, email_vencimiento_hoy_sent')
    .not('fecha_limite', 'is', null)
    .limit(500);

  if (error) {
    if (!goalSchemaWarningShown && (error.code === '42703' || error.message.includes('email_vencimiento_'))) {
      goalSchemaWarningShown = true;
      console.warn('Aplica src/database/metas_notificaciones_migration.sql para activar avisos de plazo de metas.');
      return;
    }
    throw error;
  }

  for (const meta of metas || []) {
    if (Number(meta.monto_actual || 0) >= Number(meta.monto_objetivo || 0)) continue;
    const aviso = getGoalDeadlineNotice(meta.fecha_limite);
    if (!aviso || meta[aviso.flag]) continue;

    const { data: usuario, error: userError } = await supabase
      .from('usuarios')
      .select('email, nombre, auth_id')
      .eq('id', meta.usuario_id)
      .single();
    if (userError || !usuario?.email) continue;

    const prefs = await getPrefs(usuario.auth_id);
    if (!prefs.email) continue;

    const cuando = aviso.daysRemaining === 0
      ? 'hoy'
      : `en ${aviso.daysRemaining} ${aviso.daysRemaining === 1 ? 'día' : 'días'}`;
    const sent = await sendNotificationEmail({
      to: usuario.email,
      subject: `Plazo próximo: ${meta.nombre}`,
      text: `Hola ${usuario.nombre || ''},\n\nEl plazo de tu meta "${meta.nombre}" termina ${cuando}.\nAhorro actual: ${new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP' }).format(Number(meta.monto_actual) || 0)} de ${new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP' }).format(Number(meta.monto_objetivo) || 0)}.\n\nIngresa a Notaire para revisar tu avance.`
    });
    if (!sent) continue;

    const { error: updateError } = await supabase
      .from('metas')
      .update({ [aviso.flag]: true })
      .eq('id', meta.id);
    if (updateError) console.error('No se pudo marcar el aviso de plazo enviado:', updateError.message);
  }
}

export function startEventNotificationScheduler() {
  cron.schedule('* * * * *', async () => {
    try {
      await processEventNotifications();
      await processFinancialReminderNotifications();
      await processGoalDeadlineNotifications();
    } catch (error) {
      console.error('Error enviando recordatorios:', error.message);
    }
  });
  const status = getEmailStatus();
  console.log(status.ready
    ? `Notificaciones por correo activas (Resend, modo ${status.mode}).`
    : `Notificaciones por correo inactivas; configura: ${[...status.missing, ...status.issues].join(', ')}.`);
}
