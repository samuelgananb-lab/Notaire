import cron from 'node-cron';
import { supabase } from '../database/supabase.js';

const RESEND_URL = 'https://api.resend.com/emails';
let reminderSchemaWarningShown = false;

function configured() {
  return Boolean(process.env.RESEND_API_KEY && process.env.MAIL_FROM);
}

async function sendEmail({ to, subject, text }) {
  if (!configured()) return false;

  const response = await fetch(RESEND_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ from: process.env.MAIL_FROM, to: [to], subject, text })
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`Resend respondió ${response.status}: ${detail}`);
  }
  return true;
}

export async function sendNotificationEmail({ to, subject, text }) {
  if (!to) return false;

  try {
    const sent = await sendEmail({ to, subject: `Notaire | ${subject}`, text });
    if (!sent) console.warn('Notificación por correo omitida: faltan RESEND_API_KEY o MAIL_FROM.');
    return sent;
  } catch (error) {
    console.error('Error enviando notificación por correo:', error.message);
    return false;
  }
}

function minutesUntil(evento) {
  const target = new Date(evento.fecha_hora || `${evento.fecha}T${evento.hora || '08:00'}:00`);
  return (target.getTime() - Date.now()) / 60000;
}

async function processEventNotifications() {
  if (!configured()) return;

  const { data: eventos, error } = await supabase
    .from('eventos_calendario')
    .select('id, usuario_id, titulo, nota, fecha_hora, notif24h, notif1h, notifonday, notif24_sent, notif1h_sent, notifonday_sent')
    .eq('estado', 'pendiente')
    .limit(200);

  if (error) throw error;

  for (const evento of eventos || []) {
    const remaining = minutesUntil(evento);
    const aviso = evento.notif24h && !evento.notif24_sent && remaining > 1439 && remaining <= 1441
      ? { flag: 'notif24_sent', label: 'mañana' }
      : evento.notif1h && !evento.notif1h_sent && remaining > 59 && remaining <= 61
        ? { flag: 'notif1h_sent', label: 'en una hora' }
        : evento.notifonday && !evento.notifonday_sent && remaining > -1 && remaining <= 1
          ? { flag: 'notifonday_sent', label: 'ahora' }
          : null;

    if (!aviso) continue;

    const { data: usuario, error: userError } = await supabase
      .from('usuarios')
      .select('email, nombre')
      .eq('id', evento.usuario_id)
      .single();
    if (userError || !usuario?.email) continue;

    const sent = await sendNotificationEmail({
      to: usuario.email,
      subject: `Recordatorio: ${evento.titulo}`,
      text: `Hola ${usuario.nombre || ''},\n\nTienes el evento "${evento.titulo}" ${aviso.label}.\nFecha: ${evento.fecha_hora || evento.fecha || 'No especificada'}\n${evento.nota || ''}\n\nNotaire`
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
    const dueAt = new Date(`${String(reminder.fecha_vencimiento).slice(0, 10)}T09:00:00`);
    const remainingMinutes = (dueAt.getTime() - Date.now()) / 60000;
    const aviso = !reminder.email_24h_sent && remainingMinutes > 0 && remainingMinutes <= 24 * 60
      ? { flag: 'email_24h_sent', subject: 'Compromiso próximo a vencer', when: 'vence dentro de las próximas 24 horas' }
      : !reminder.email_due_sent && remainingMinutes <= 0
        ? { flag: 'email_due_sent', subject: 'Compromiso financiero vencido', when: 'ya llegó a su fecha de vencimiento' }
        : null;

    if (!aviso) continue;

    const { data: usuario, error: userError } = await supabase
      .from('usuarios')
      .select('email, nombre')
      .eq('id', reminder.usuario_id)
      .single();
    if (userError || !usuario?.email) continue;

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

export function startEventNotificationScheduler() {
  cron.schedule('* * * * *', async () => {
    try {
      await processEventNotifications();
      await processFinancialReminderNotifications();
    } catch (error) {
      console.error('Error enviando recordatorios:', error.message);
    }
  });
  console.log(configured()
    ? 'Notificaciones por correo activas.'
    : 'Notificaciones por correo inactivas: faltan RESEND_API_KEY y MAIL_FROM.');
}
