import assert from 'node:assert/strict';
import test from 'node:test';
import { createEventNotificationChecker } from '../src/app/services/event-notifications.service.js';
import { createCronNotificationHandler, isCronAuthorizationValid } from '../src/app/services/cron-notifications.service.js';
import { createNotificationDeliveryService } from '../src/app/services/notification-delivery.service.js';

function createDeliveryClient(now = () => Date.now()) {
  const rows = new Map();
  const keyFor = parameters => [
    parameters.p_source_type,
    parameters.p_source_id,
    parameters.p_notification_type,
    parameters.p_source_version
  ].join('/');

  return {
    rows,
    client: {
      async rpc(name, parameters) {
        const key = keyFor(parameters);
        const row = rows.get(key);

        if (name === 'claim_notification_delivery') {
          if (row?.status === 'sent') return { data: 'sent', error: null };
          if (row?.status === 'processing' && row.leaseUntil > now()) {
            return { data: 'busy', error: null };
          }
          if (row?.status === 'pending' && row.nextAttemptAt > now()) {
            return { data: 'busy', error: null };
          }

          rows.set(key, {
            status: 'processing',
            claimToken: parameters.p_claim_token,
            attempts: (row?.attempts || 0) + 1,
            leaseUntil: now() + parameters.p_lease_seconds * 1000
          });
          return { data: 'claimed', error: null };
        }

        if (name === 'complete_notification_delivery') {
          if (!row || row.status !== 'processing' || row.claimToken !== parameters.p_claim_token) {
            return { data: false, error: null };
          }
          row.status = 'sent';
          row.claimToken = null;
          return { data: true, error: null };
        }

        if (name === 'release_notification_delivery') {
          if (!row || row.status !== 'processing' || row.claimToken !== parameters.p_claim_token) {
            return { data: false, error: null };
          }
          row.status = 'pending';
          row.claimToken = null;
          row.nextAttemptAt = now() + 30_000;
          row.lastError = parameters.p_error;
          return { data: true, error: null };
        }

        throw new Error(`RPC inesperado: ${name}`);
      }
    }
  };
}

function createEventDatabase(evento) {
  const usuario = { id: evento.usuario_id, email: 'cliente@example.test', nombre: 'Cliente', auth_id: 'auth-1' };

  return {
    from(table) {
      let update = null;
      return {
        select() { return this; },
        eq() { return this; },
        limit() {
          return Promise.resolve({ data: [structuredClone(evento)], error: null });
        },
        single() {
          return Promise.resolve({ data: usuario, error: null });
        },
        update(values) {
          update = values;
          return this;
        },
        then(resolve, reject) {
          if (table === 'eventos_calendario' && update) Object.assign(evento, update);
          return Promise.resolve({ data: null, error: null }).then(resolve, reject);
        }
      };
    }
  };
}

test('avisos 24 horas, 1 hora y a la hora del evento se envían una sola vez en concurrencia', async () => {
  const evento = {
    id: 'event-42',
    usuario_id: 'user-9',
    titulo: 'Firma de escritura',
    nota: '',
    fecha: '2025-01-02',
    hora: '08:00',
    notification_version: 1,
    notif24h: true,
    notif1h: true,
    notifonday: true,
    notif24_sent: false,
    notif1h_sent: false,
    notifonday_sent: false
  };
  let now = Date.parse('2025-01-01T13:00:00.000Z');
  const deliveryStore = createDeliveryClient(() => now);
  const deliver = createNotificationDeliveryService({
    client: deliveryStore.client,
    createToken: (() => {
      let token = 0;
      return () => `claim-${++token}`;
    })()
  });
  const sentKeys = [];
  const check = createEventNotificationChecker({
    database: createEventDatabase(evento),
    readPrefs: async () => ({ email: true, h24: true, h1: true }),
    emailStatus: () => ({ ready: true }),
    deliver,
    now: () => now,
    sendEmail: async ({ idempotencyKey }) => {
      sentKeys.push(idempotencyKey);
      await new Promise(resolve => setTimeout(resolve, 5));
      return true;
    }
  });

  await Promise.all([check(), check()]);
  assert.equal(evento.notif24_sent, true);
  assert.deepEqual(sentKeys, ['event/event-42/notif24_sent/1']);

  now = Date.parse('2025-01-02T12:00:00.000Z');
  await Promise.all([check(), check()]);
  assert.equal(evento.notif1h_sent, true);
  assert.deepEqual(sentKeys, [
    'event/event-42/notif24_sent/1',
    'event/event-42/notif1h_sent/1'
  ]);

  now = Date.parse('2025-01-02T13:00:00.000Z');
  await Promise.all([check(), check()]);
  assert.equal(evento.notifonday_sent, true);
  assert.deepEqual(sentKeys, [
    'event/event-42/notif24_sent/1',
    'event/event-42/notif1h_sent/1',
    'event/event-42/notifonday_sent/1'
  ]);
  assert.ok([...deliveryStore.rows.values()].every(row => row.status === 'sent'));
});

test('un envío fallido se libera y reintenta con la misma clave idempotente', async () => {
  let now = 1_000_000;
  const store = createDeliveryClient(() => now);
  const deliver = createNotificationDeliveryService({
    client: store.client,
    createToken: (() => {
      let token = 0;
      return () => `retry-${++token}`;
    })()
  });
  const keys = [];
  const delivery = {
    sourceType: 'event',
    sourceId: 'event-7',
    notificationType: 'notif24_sent',
    sourceVersion: 3
  };

  await assert.rejects(deliver({
    ...delivery,
    send: async key => {
      keys.push(key);
      throw new Error('timeout Resend');
    }
  }), /timeout Resend/);

  assert.equal([...store.rows.values()][0].status, 'pending');
  assert.equal((await deliver({ ...delivery, send: async () => true })).status, 'not-claimed');
  now += 30_000;

  assert.equal((await deliver({
    ...delivery,
    send: async key => {
      keys.push(key);
      return true;
    }
  })).status, 'sent');
  assert.deepEqual(keys, [
    'event/event-7/notif24_sent/3',
    'event/event-7/notif24_sent/3'
  ]);
});

test('el cron exige el bearer secret y envía el resumen solo los lunes a las 08:00 de Bogotá', async () => {
  assert.equal(isCronAuthorizationValid('Bearer secret-value', 'secret-value'), true);
  assert.equal(isCronAuthorizationValid('Bearer wrong-value', 'secret-value'), false);
  assert.equal(isCronAuthorizationValid('secret-value', 'secret-value'), false);
  assert.equal(isCronAuthorizationValid('Bearer secret-value', ''), false);

  let now = new Date('2025-01-06T12:59:00.000Z');
  let notifications = 0;
  let summaries = 0;
  const handler = createCronNotificationHandler({
    getSecret: () => 'secret-value',
    runNotifications: async () => { notifications += 1; },
    sendWeeklySummary: async () => { summaries += 1; },
    now: () => now,
    logger: { error() {} }
  });
  const invoke = async authorization => {
    const response = {
      statusCode: 200,
      status(code) { this.statusCode = code; return this; },
      json(body) { this.body = body; return this; }
    };
    const request = { get: () => authorization };
    await handler(request, response);
    return response;
  };

  const unavailableHandler = createCronNotificationHandler({
    getSecret: () => '',
    runNotifications: async () => { notifications += 1; },
    sendWeeklySummary: async () => { summaries += 1; }
  });
  const unavailableResponse = {
    statusCode: 200,
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; }
  };
  await unavailableHandler({ get: () => 'Bearer secret-value' }, unavailableResponse);
  assert.equal(unavailableResponse.statusCode, 503);

  assert.equal((await invoke('Bearer wrong-value')).statusCode, 401);
  assert.equal(notifications, 0);

  const beforeEight = await invoke('Bearer secret-value');
  assert.equal(beforeEight.body.resumenSemanal, false);
  now = new Date('2025-01-06T13:00:00.000Z');
  const atEight = await invoke('Bearer secret-value');
  assert.equal(atEight.body.resumenSemanal, true);
  assert.equal(notifications, 2);
  assert.equal(summaries, 1);
});
