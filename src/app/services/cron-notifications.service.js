import { timingSafeEqual } from 'node:crypto';

export function isCronAuthorizationValid(authorization, secret) {
  if (typeof authorization !== 'string' || typeof secret !== 'string' || !secret) return false;
  const expected = Buffer.from(`Bearer ${secret}`, 'utf8');
  const received = Buffer.from(authorization, 'utf8');
  return expected.length === received.length && timingSafeEqual(expected, received);
}

export function createCronNotificationHandler({
  getSecret = () => process.env.CRON_SECRET,
  runNotifications,
  sendWeeklySummary,
  now = () => new Date(),
  logger = console
} = {}) {
  if (typeof runNotifications !== 'function' || typeof sendWeeklySummary !== 'function') {
    throw new Error('El manejador del cron requiere sus tareas de notificación.');
  }

  return async function handleCronNotifications(req, res) {
    const secret = getSecret();
    if (!secret) return res.status(503).json({ error: 'CRON_SECRET no configurado' });
    if (!isCronAuthorizationValid(req.get('authorization'), secret)) {
      return res.status(401).json({ error: 'No autorizado' });
    }

    try {
      await runNotifications();
      const localTime = Object.fromEntries(new Intl.DateTimeFormat('en-US', {
        weekday: 'short',
        hour: '2-digit',
        hourCycle: 'h23',
        timeZone: 'America/Bogota'
      }).formatToParts(now()).map(({ type, value }) => [type, value]));
      const resumenSemanal = localTime.weekday === 'Mon' && localTime.hour === '08';

      if (resumenSemanal) await sendWeeklySummary();

      return res.json({
        ok: true,
        notificaciones: 'procesadas',
        resumenSemanal
      });
    } catch (error) {
      logger.error('Error procesando notificaciones programadas:', error);
      return res.status(500).json({ error: 'No se pudieron procesar las notificaciones programadas' });
    }
  };
}
