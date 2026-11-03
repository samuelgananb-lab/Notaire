import assert from 'node:assert/strict';
import test from 'node:test';

process.env.NODE_ENV = 'test';
process.env.SUPABASE_URL = 'https://notaire-test.supabase.co';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-role-key';
process.env.JWT_SECRET = 'test-jwt-secret-with-more-than-thirty-two-characters';
process.env.PASSWORD_RESET_REDIRECT_URL = 'http://localhost:3000/auth/cambiar-password.html';
process.env.CORS_ORIGINS = '';

const [{ default: app }, { supabase }] = await Promise.all([
  import('../src/app/app.js'),
  import('../src/app/database/supabase.js')
]);

async function startTestServer(t) {
  const server = app.listen(0, '127.0.0.1');
  t.after(() => new Promise((resolve, reject) => {
    server.close(error => error ? reject(error) : resolve());
  }));
  await new Promise((resolve, reject) => {
    server.once('listening', resolve);
    server.once('error', reject);
  });
  return `http://127.0.0.1:${server.address().port}`;
}

test('el servidor local entrega páginas y recursos estáticos y conserva rutas API', async t => {
  t.mock.method(supabase, 'from', table => {
    assert.equal(table, 'usuarios');
    return {
      select() { return this; },
      async limit() { return { error: null }; }
    };
  });

  const baseUrl = await startTestServer(t);
  const checks = [
    ['/', /Notaire - Inicio/],
    ['/auth/login.html', /Iniciar sesión/i],
    ['/auth/register.html', /Crear cuenta/i],
    ['/auth/olvide-password.html', /recuperar/i],
    ['/auth/cambiar-password.html', /contraseña/i]
  ];

  for (const [route, content] of checks) {
    const response = await fetch(`${baseUrl}${route}`);
    assert.equal(response.status, 200, route);
    assert.match(await response.text(), content, route);
  }

  for (const [route, contentType] of [
    ['/assets/css/landing.css', /text\/css/],
    ['/assets/js/landing.js', /javascript/],
    ['/favicon.svg', /svg/]
  ]) {
    const response = await fetch(`${baseUrl}${route}`);
    assert.equal(response.status, 200, route);
    assert.match(response.headers.get('content-type'), contentType, route);
  }

  const health = await fetch(`${baseUrl}/api/health`);
  assert.equal(health.status, 200);
  assert.deepEqual(await health.json(), {
    status: 'OK',
    message: 'Conectado exitosamente a Supabase'
  });

  const register = await fetch(`${baseUrl}/api/auth/registro`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: '{}'
  });
  assert.equal(register.status, 400);
});

test('health oculta detalles internos de Supabase ante error', async t => {
  const logged = [];
  t.mock.method(console, 'error', (...args) => logged.push(args));
  t.mock.method(supabase, 'from', () => ({
    select() { return this; },
    async limit() { return { error: { message: 'internal database detail' } }; }
  }));

  const baseUrl = await startTestServer(t);
  const response = await fetch(`${baseUrl}/api/health`);
  assert.equal(response.status, 500);
  assert.deepEqual(await response.json(), {
    status: 'Error',
    error: 'No se pudo conectar a Supabase'
  });
  assert.doesNotMatch(JSON.stringify(logged), /internal database detail/);
});