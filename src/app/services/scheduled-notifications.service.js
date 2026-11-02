import cron from 'node-cron';
import { getEmailStatus } from './email.service.js';
import { processPendingBudgetAlertNotifications, enviarResumenSemanal } from './finance-alerts.service.js';
import { runEventNotificationChecks } from './event-notifications.service.js';

export async function runScheduledNotifications() {
  await runEventNotificationChecks();
  await processPendingBudgetAlertNotifications();
}

export function startScheduledNotificationScheduler() {
  cron.schedule('* * * * *', async () => {
    try {
      await runScheduledNotifications();
    } catch (error) {
      console.error('Error enviando notificaciones programadas:', error.message);
    }
  });

  const status = getEmailStatus();
  console.log(status.disabled
    ? 'Notificaciones por correo desactivadas (EMAIL_MODE=disabled).'
    : status.ready
      ? `Notificaciones por correo activas (Resend, modo ${status.mode}).`
      : `Notificaciones por correo inactivas; configura: ${[...status.missing, ...status.issues].join(', ')}.`);
}

export { enviarResumenSemanal };
