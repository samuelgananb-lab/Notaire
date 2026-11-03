import assert from 'node:assert/strict';
import test from 'node:test';

process.env.SUPABASE_URL = 'https://notaire-rate-limit-test.supabase.co';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-role-key';
process.env.JWT_SECRET = 'test-jwt-secret-with-more-than-thirty-two-characters';
process.env.LOGIN_RATE_LIMIT_IP_MAX = '30';
process.env.LOGIN_RATE_LIMIT_ACCOUNT_MAX = '5';
process.env.LOGIN_RATE_LIMIT_WINDOW_SECONDS = '900';

const { createLoginRateLimit, createLocalAttemptLimiter } = await import('../src/app/middlewares/login-rate-limit.middleware.js');

function createResponse() {
  return {
    statusCode: 200,
    headers: {},
    body: null,
    set(name, value) { this.headers[name] = value; return this; },
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; }
  };
}

test('el limiter permite intentos aprobados y solo entrega hashes al almacenamiento', async () => {
  let received;
  let nextCalled = false;
  const middleware = createLoginRateLimit({
    consume: async input => {
      received = input;
      return { allowed: true, retry_after_seconds: 0 };
    },
    config: { ipAttempts: 30, accountAttempts: 5, windowSeconds: 900 },
    logger: { error() {} }
  });
  const response = createResponse();

  await middleware({ ip: '192.0.2.10', body: { email: 'User@Example.test' } }, response, () => { nextCalled = true; });

  assert.equal(nextCalled, true);
  assert.match(received.ipHash, /^[a-f0-9]{64}$/);
  assert.match(received.accountHash, /^[a-f0-9]{64}$/);
  assert.notEqual(received.ipHash, '192.0.2.10');
  assert.notEqual(received.accountHash, 'user@example.test');
});

test('el limiter responde 429 y Retry-After cuando Supabase rechaza el intento', async () => {
  let nextCalled = false;
  const middleware = createLoginRateLimit({
    consume: async () => ({ allowed: false, retry_after_seconds: 87 }),
    logger: { error() {} }
  });
  const response = createResponse();

  await middleware({ ip: '192.0.2.10', body: { email: 'user@example.test' } }, response, () => { nextCalled = true; });

  assert.equal(response.statusCode, 429);
  assert.equal(response.headers['Retry-After'], '87');
  assert.equal(nextCalled, false);
});

test('el limiter falla cerrado si el almacenamiento central no está disponible', async () => {
  let nextCalled = false;
  const logged = [];
  const middleware = createLoginRateLimit({
    consume: async () => { throw Object.assign(new Error('database details'), { code: 'TEST' }); },
    logger: { error: (...args) => logged.push(args) }
  });
  const response = createResponse();

  await middleware({ ip: '192.0.2.10', body: { email: 'user@example.test' } }, response, () => { nextCalled = true; });

  assert.equal(response.statusCode, 503);
  assert.equal(nextCalled, false);
  assert.doesNotMatch(JSON.stringify(response.body), /database details/);
  assert.doesNotMatch(JSON.stringify(logged), /user@example\.test|192\.0\.2\.10|database details/);
});

test('el limiter falla cerrado si no puede identificar la IP', async () => {
  let calls = 0;
  const middleware = createLoginRateLimit({
    consume: async () => { calls += 1; return { allowed: true }; },
    logger: { error() {} }
  });
  const response = createResponse();

  await middleware({ body: {} }, response, () => {});

  assert.equal(response.statusCode, 503);
  assert.equal(calls, 0);
});

test('desarrollo usa limitador local cuando la RPC falta y continúa limitando por cuenta e IP', async () => {
  let timestamp = 1_000;
  let warningCount = 0;
  let nextCount = 0;
  const localConsume = createLocalAttemptLimiter({ now: () => timestamp });
  const middleware = createLoginRateLimit({
    consume: async () => { throw Object.assign(new Error('RPC missing'), { code: 'PGRST202' }); },
    localConsume,
    config: { ipAttempts: 10, accountAttempts: 2, windowSeconds: 60 },
    allowLocalFallback: true,
    logger: { warn() { warningCount += 1; }, error() {} }
  });
  const invoke = async () => {
    const response = createResponse();
    await middleware({ ip: '192.0.2.11', body: { email: 'user@example.test' } }, response, () => { nextCount += 1; });
    return response;
  };

  assert.equal((await invoke()).statusCode, 200);
  assert.equal((await invoke()).statusCode, 200);
  const limited = await invoke();
  assert.equal(limited.statusCode, 429);
  assert.equal(limited.headers['Retry-After'], '60');
  assert.equal(nextCount, 2);
  assert.equal(warningCount, 1);

  timestamp += 60_000;
  assert.equal((await invoke()).statusCode, 200);
});

test('producción sigue fallando cerrado si falta la RPC', async () => {
  let localCalls = 0;
  const middleware = createLoginRateLimit({
    consume: async () => { throw Object.assign(new Error('RPC missing'), { code: 'PGRST202' }); },
    localConsume: () => { localCalls += 1; return { allowed: true, retry_after_seconds: 0 }; },
    allowLocalFallback: false,
    logger: { warn() {}, error() {} }
  });
  const response = createResponse();

  await middleware({ ip: '192.0.2.11', body: { email: 'user@example.test' } }, response, () => {});

  assert.equal(response.statusCode, 503);
  assert.equal(localCalls, 0);
});