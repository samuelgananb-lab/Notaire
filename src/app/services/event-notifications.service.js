import cron from 'node-cron';
import { supabase } from '../database/supabase.js';
import { getPrefs } from './notification-prefs.service.js';
import { getGoalDeadlineNotice } from './goal-notification-rules.js';
import { getEmailStatus, sendAppEmail } from './email.service.js';
import { deliverNotificationOnce } from './notification-delivery.service.js';

let reminderSchemaWarningShown = false;
let goalSchemaWarningShown = false;

function configured() {
  return getEmailStatus().ready;
}

export async function sendNotificationEmail({ to, subject, text, idempotencyKey }) {
  if (!to) {
    console.warn('Correo omitido: falta el destinatario.');
    return false;
  }

  try {
    return await sendAppEmail({ to, subject, text, idempotencyKey });
  } catch (error) {
    console.error('Error enviando notificación por correo:', error.message);
    if (idempotencyKey) throw error;
    return false;
  }
}

function minutesUntil(evento, now = Date.now()) {
  const target = evento.fecha
    ? new Date(`${evento.fecha}T${String(evento.hora || '08:00').slice(0, 5)}:00-05:00`)
    : new Date(evento.fecha_hora);
  return (target.getTime() - now) / 60000;
}

async function sendTrackedNotification({
  database,
  deliver,
  sendEmail,
  table,
  sourceType,
  sourceId,
  sourceVersion,
  notificationType,
  message
}) {
  const result = await deliver({
    sourceType,
    sourceId,
    sourceVersion,
    notificationType,
    send: idempotencyKey => sendEmail({ ...message, idempotencyKey })
  });

  if (!['sent', 'already-sent'].includes(result.status)) return false;

  const { error } = await database
    .from(table)
    .update({ [notificationType]: true })
    .eq('id', sourceId);
  if (error) throw new Error(`No se pudo marcar el aviso de ${table} como enviado: ${error.message}`);
  return true;
}

export function createEventNotificationChecker({
  database = supabase,
  readPrefs = getPrefs,
  emailStatus = getEmailStatus,
  sendEmail = sendNotificationEmail,
  deliver = deliverNotificationOnce,
  now = () => Date.now()
} = {}) {
  return async function processEventNotifications() {
    if (!emailStatus().ready) return;

    const { data: eventos, error } = await database
      .from('eventos_calendario')
      .select('id, usuario_id, titulo, nota, fecha, hora, fecha_hora, notification_version, notif24h, notif1h, notifonday, notif24_sent, notif1h_sent, notifonday_sent')
      .eq('estado', 'pendiente')
      .limit(200);

    if (error) throw error;

    for (const evento of eventos || []) {
      const remaining = minutesUntil(evento, now());
      const aviso = evento.notif24h && !evento.notif24_sent && remaining > 0 && remaining <= 24 * 60
        ? { flag: 'notif24_sent', label: 'mañana' }
        : evento.notif1h && !evento.notif1h_sent && remaining > 0 && remaining <= 60
          ? { flag: 'notif1h_sent', label: 'en una hora' }
          : evento.notifonday && !evento.notifonday_sent && remaining > -5 && remaining <= 1
            ? { flag: 'notifonday_sent', label: 'ahora' }
            : null;

      if (!aviso) continue;

      const { data: usuario, error: userError } = await database
        .from('usuarios')
        .select('email, nombre, auth_id')
        .eq('id', evento.usuario_id)
        .single();
      if (userError) throw userError;
      if (!usuario?.email) continue;

      const prefs = await readPrefs(usuario.auth_id);
      const avisoDesactivado = (aviso.flag === 'notif24_sent' && !prefs.h24) ||
        (aviso.flag === 'notif1h_sent' && !prefs.h1);
      if (avisoDesactivado) {
        const { error: updateError } = await database
          .from('eventos_calendario')
          .update({ [aviso.flag]: true })
          .eq('id', evento.id);
        if (updateError) throw new Error(`No se pudo descartar el aviso desactivado: ${updateError.message}`);
        continue;
      }
      if (!prefs.email) continue;

      await sendTrackedNotification({
        database,
        deliver,
        sendEmail,
        table: 'eventos_calendario',
        sourceType: 'event',
        sourceId: evento.id,
        sourceVersion: evento.notification_version || 1,
        notificationType: aviso.flag,
        message: {
          to: usuario.email,
          subject: `Recordatorio: ${evento.titulo}`,
          text: `Hola ${usuario.nombre || ''},\n\nTienes el evento "${evento.titulo}" ${aviso.label}.\nFecha: ${evento.fecha || 'No especificada'} ${evento.hora || '08:00'}\n${evento.nota || ''}\n\nNotaire`
        }
      });
    }
  };
}

const processEventNotifications = createEventNotificationChecker();

async function processFinancialReminderNotifications() {
  if (!configured()) return;

  const { data: reminders, error } = await supabase
    .from('recordatorios')
    .select('id, usuario_id, titulo, monto, fecha_vencimiento, estado, notification_version, email_24h_sent, email_due_sent')
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
    if (userError) throw userError;
    if (!usuario?.email) continue;

    const prefs = await getPrefs(usuario.auth_id);
    if (!prefs.email) continue;

    await sendTrackedNotification({
      database: supabase,
      deliver: deliverNotificationOnce,
      sendEmail: sendNotificationEmail,
      table: 'recordatorios',
      sourceType: 'financial-reminder',
      sourceId: reminder.id,
      sourceVersion: reminder.notification_version || 1,
      notificationType: aviso.flag,
      message: {
        to: usuario.email,
        subject: aviso.subject,
        text: `Hola ${usuario.nombre || ''},\n\nTu compromiso "${reminder.titulo}" ${aviso.when}.\nMonto: ${new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP' }).format(Number(reminder.monto) || 0)}\nFecha de vencimiento: ${reminder.fecha_vencimiento}\n\nIngresa a Notaire para revisar tus compromisos.`
      }
    });
  }
}

async function processGoalDeadlineNotifications() {
  if (!configured()) return;

  const { data: metas, error } = await supabase
    .from('metas')
    .select('id, usuario_id, nombre, monto_objetivo, monto_actual, fecha_limite, notification_version, email_vencimiento_7d_sent, email_vencimiento_3d_sent, email_vencimiento_1d_sent, email_vencimiento_hoy_sent')
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
    if (userError) throw userError;
    if (!usuario?.email) continue;

    const prefs = await getPrefs(usuario.auth_id);
    if (!prefs.email) continue;

    const cuando = aviso.daysRemaining === 0
      ? 'hoy'
      : `en ${aviso.daysRemaining} ${aviso.daysRemaining === 1 ? 'día' : 'días'}`;
    await sendTrackedNotification({
      database: supabase,
      deliver: deliverNotificationOnce,
      sendEmail: sendNotificationEmail,
      table: 'metas',
      sourceType: 'goal-deadline',
      sourceId: meta.id,
      sourceVersion: meta.notification_version || 1,
      notificationType: aviso.flag,
      message: {
        to: usuario.email,
        subject: `Plazo próximo: ${meta.nombre}`,
        text: `Hola ${usuario.nombre || ''},\n\nEl plazo de tu meta "${meta.nombre}" termina ${cuando}.\nAhorro actual: ${new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP' }).format(Number(meta.monto_actual) || 0)} de ${new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP' }).format(Number(meta.monto_objetivo) || 0)}.\n\nIngresa a Notaire para revisar tu avance.`
      }
    });
  }
}

export async function runEventNotificationChecks() {
  await processEventNotifications();
  await processFinancialReminderNotifications();
  await processGoalDeadlineNotifications();
}

export function startEventNotificationScheduler() {
  cron.schedule('* * * * *', async () => {
    try {
      await runEventNotificationChecks();
    } catch (error) {
      console.error('Error enviando recordatorios:', error.message);
    }
  });
  const status = getEmailStatus();
  console.log(status.ready
    ? `Notificaciones por correo activas (Resend, modo ${status.mode}).`
    : `Notificaciones por correo inactivas; configura: ${[...status.missing, ...status.issues].join(', ')}.`);
}
