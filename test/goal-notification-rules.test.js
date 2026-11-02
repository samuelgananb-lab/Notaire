import test from 'node:test';
import assert from 'node:assert/strict';
import { getGoalDeadlineNotice } from '../src/app/services/goal-notification-rules.js';

test('calcula avisos de plazo con la fecha local de Bogotá', () => {
  const now = new Date('2025-01-01T05:30:00.000Z');

  assert.deepEqual(getGoalDeadlineNotice('2025-01-08', now), {
    daysRemaining: 7,
    flag: 'email_vencimiento_7d_sent'
  });
  assert.deepEqual(getGoalDeadlineNotice('2025-01-04', now), {
    daysRemaining: 3,
    flag: 'email_vencimiento_3d_sent'
  });
  assert.deepEqual(getGoalDeadlineNotice('2025-01-02', now), {
    daysRemaining: 1,
    flag: 'email_vencimiento_1d_sent'
  });
  assert.deepEqual(getGoalDeadlineNotice('2025-01-01', now), {
    daysRemaining: 0,
    flag: 'email_vencimiento_hoy_sent'
  });
});

test('omite fechas inválidas y fechas fuera de las ventanas de aviso', () => {
  const now = new Date('2025-01-01T05:30:00.000Z');

  assert.equal(getGoalDeadlineNotice('2025-02-31', now), null);
  assert.equal(getGoalDeadlineNotice('fecha inválida', now), null);
  assert.equal(getGoalDeadlineNotice('2025-01-03', now), null);
});
