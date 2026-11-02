import 'dotenv/config';
import app from './app.js';
import { startScheduledNotificationScheduler } from './services/scheduled-notifications.service.js';
import { startWeeklySummaryScheduler } from './services/finance-alerts.service.js';

const PORT = Number.parseInt(process.env.PORT || '3000', 10);

app.listen(PORT, () => {
  console.log(`Servidor Notaire ejecutándose en http://localhost:${PORT}`);
  startScheduledNotificationScheduler();
  startWeeklySummaryScheduler();
});
