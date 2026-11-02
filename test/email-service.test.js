import assert from 'node:assert/strict';
import test from 'node:test';
import {
  createEmailService,
  getEmailConfiguration,
  renderEmailHtml
} from '../src/app/services/email.service.js';

const developmentEnv = (overrides = {}) => ({
  EMAIL_PROVIDER: 'resend',
  EMAIL_MODE: 'development',
  RESEND_API_KEY: 're_test_not_a_real_key',
  MAIL_FROM: 'Notaire <onboarding@resend.dev>',
  MAIL_TEST_RECIPIENT: 'authorized@example.test',
  PUBLIC_APP_URL: 'http://localhost:3000',
  ...overrides
});

function createSender(env, { response = { data: { id: 'email_test_123' }, error: null } } = {}) {
  const calls = [];
  const options = [];
  const logs = [];
  const service = createEmailService({
    env,
    resendFactory: apiKey => {
      assert.equal(apiKey, env.RESEND_API_KEY);
      return {
        emails: {
          send: async (payload, sendOptions) => {
            calls.push(payload);
            options.push(sendOptions);
            return response;
          }
        }
      };
    },
    logger: {
      info: message => logs.push(message),
      warn: message => logs.push(message),
      error: message => logs.push(message)
    }
  });
  return { service, calls, options, logs };
}

test('desarrollo redirige todos los destinatarios al autorizado', async () => {
  const { service, calls, logs } = createSender(developmentEnv());

  assert.equal(await service.send({
    to: 'usuario-real@example.test',
    subject: 'Resumen personal',
    text: 'Información de prueba'
  }), true);
  assert.deepEqual(calls[0].to, ['authorized@example.test']);
  assert.equal(calls[0].from, 'Notaire <onboarding@resend.dev>');
  assert.match(calls[0].html, /notaire-auth-logo\.svg/);
  assert.match(logs.at(-1), /id=email_test_123/);
});

test('desarrollo no envía si falta la configuración o el destinatario autorizado', async () => {
  let factoryCalls = 0;
  const logger = { warn() {}, info() {}, error() {} };
  const service = createEmailService({
    env: developmentEnv({ MAIL_TEST_RECIPIENT: '' }),
    resendFactory: () => { factoryCalls += 1; },
    logger
  });

  assert.equal(service.getStatus().ready, false);
  assert.deepEqual(service.getStatus().missing, ['MAIL_TEST_RECIPIENT']);
  assert.equal(await service.send({ to: 'user@example.test', subject: 'Test', text: 'Test' }), false);
  assert.equal(factoryCalls, 0);
});

test('rechaza destinatarios y asuntos inválidos antes de llamar a Resend', async () => {
  const { service, calls } = createSender(developmentEnv());

  await assert.rejects(
    service.send({ to: 'no-es-correo', subject: 'Test', text: 'Body' }),
    /destinatario.*no es válido/
  );
  await assert.rejects(
    service.send({ to: 'user@example.test', subject: 'Test\nBcc: other@example.test', text: 'Body' }),
    /saltos de línea/
  );
  assert.equal(calls.length, 0);
});

test('producción requiere configuración segura y conserva destinatarios legítimos', async () => {
  const productionEnv = {
    EMAIL_PROVIDER: 'resend',
    EMAIL_MODE: 'production',
    RESEND_API_KEY: 're_test_not_a_real_key',
    MAIL_FROM: 'Notaire <notificaciones@notaire.example>',
    PUBLIC_APP_URL: 'https://notaire.example'
  };
  const { service, calls } = createSender(productionEnv);

  assert.equal(service.getStatus().ready, true);
  assert.equal(await service.send({
    to: ['Cliente@ejemplo.com', 'cliente@ejemplo.com', 'admin@ejemplo.com'],
    subject: 'Actualización',
    text: 'Tu cuenta fue actualizada.'
  }), true);
  assert.deepEqual(calls[0].to, ['cliente@ejemplo.com', 'admin@ejemplo.com']);
});

test('producción falla al iniciar con variables incompletas o remitente de prueba', () => {
  assert.throws(() => createEmailService({
    env: { EMAIL_MODE: 'production' },
    logger: { warn() {} }
  }), /Configuración de correo de producción inválida/);

  const invalidProductionConfig = getEmailConfiguration({
    EMAIL_MODE: 'production',
    RESEND_API_KEY: 'test',
    MAIL_FROM: 'Notaire <onboarding@resend.dev>',
    PUBLIC_APP_URL: 'https://notaire.example'
  });
  assert.equal(invalidProductionConfig.ready, false);
  assert.match(invalidProductionConfig.issues.join(' '), /no se permite en producción/);
});

test('un error de Resend no se reporta como envío exitoso', async () => {
  const { service, calls } = createSender(developmentEnv(), {
    response: { data: null, error: { message: 'sender domain is not verified' } }
  });

  test('envía claves idempotentes como opciones de Resend', async () => {
    const { service, options } = createSender(developmentEnv());

    assert.equal(await service.send({
      to: 'usuario-real@example.test',
      subject: 'Aviso programado',
      text: 'Contenido del aviso.',
      idempotencyKey: 'event/42/notif24_sent/1'
    }), true);
    assert.deepEqual(options[0], { idempotencyKey: 'event/42/notif24_sent/1' });
  });

  await assert.rejects(
    service.send({ to: 'user@example.test', subject: 'Test', text: 'Body' }),
    /Resend rechazó el correo/
  );
  assert.equal(calls.length, 1);
});

test('la plantilla escapa contenido y enlaces de forma segura', () => {
  const html = renderEmailHtml({
    subject: '<script>asunto</script>',
    text: '<img src=x onerror=alert(1)>',
    appUrl: 'https://notaire.example'
  });

  assert.doesNotMatch(html, /<script>/);
  assert.match(html, /&lt;script&gt;asunto&lt;\/script&gt;/);
  assert.match(html, /&lt;img src=x onerror=alert\(1\)&gt;/);
  assert.match(html, /href="https:\/\/notaire\.example"/);
});
