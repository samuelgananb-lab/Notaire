import assert from 'node:assert/strict';
import test from 'node:test';
import bcrypt from 'bcryptjs';

process.env.NODE_ENV = 'test';
process.env.SUPABASE_URL = 'https://notaire-auth-test.supabase.co';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-role-key';
process.env.JWT_SECRET = 'test-jwt-secret-with-more-than-thirty-two-characters';
process.env.PASSWORD_RESET_REDIRECT_URL = 'http://localhost:3000/auth/cambiar-password.html';
process.env.CORS_ORIGINS = '';
process.env.LOGIN_RATE_LIMIT_IP_MAX = '30';
process.env.LOGIN_RATE_LIMIT_ACCOUNT_MAX = '5';
process.env.LOGIN_RATE_LIMIT_WINDOW_SECONDS = '900';

const [{ default: app }, { supabase, supabaseAuth }, { JWT_SECRET }, jwt] = await Promise.all([
  import('../src/app/app.js'),
  import('../src/app/database/supabase.js'),
  import('../src/app/middlewares/auth.middleware.js'),
  import('jsonwebtoken')
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

test('el rol se obtiene de la base y no del token al proteger admin y finanzas', async t => {
  let databaseRole = 'cliente';
  t.mock.method(supabaseAuth.auth, 'getUser', async () => ({ data: { user: null }, error: { message: 'not a Supabase token' } }));
  t.mock.method(supabase, 'from', table => {
    let selectedTable = table;
    return {
      select() { return this; },
      eq() { return this; },
      or() { return this; },
      async maybeSingle() {
        if (selectedTable === 'usuarios') {
          return {
            data: { id: 'user-1', auth_id: null, email: 'user@example.test', id_rol: 'role-from-database', nombre: 'Test' },
            error: null
          };
        }
        return { data: { nombre_rol: databaseRole }, error: null };
      }
    };
  });

  const server = app.listen(0, '127.0.0.1');
  t.after(() => new Promise((resolve, reject) => {
    server.close(error => error ? reject(error) : resolve());
  }));
  await new Promise((resolve, reject) => {
    server.once('listening', resolve);
    server.once('error', reject);
  });
  const baseUrl = `http://127.0.0.1:${server.address().port}`;
  const token = jwt.default.sign({ id: 'user-1', id_rol: 'admin' }, JWT_SECRET);
  const headers = { Authorization: `Bearer ${token}` };

  const adminResponse = await fetch(`${baseUrl}/api/admin/users`, { headers });
  assert.equal(adminResponse.status, 403);

  databaseRole = 'empleado';
  const financialResponse = await fetch(`${baseUrl}/api/transacciones`, { headers });
  assert.equal(financialResponse.status, 403);
});

test('el fallback bcrypt para cuentas locales antiguas permanece implementado', async () => {
  const { readFile } = await import('node:fs/promises');
  const { fileURLToPath } = await import('node:url');
  const { dirname, resolve } = await import('node:path');
  const route = await readFile(resolve(dirname(fileURLToPath(import.meta.url)), '../src/app/routes/auth.routes.js'), 'utf8');
  assert.match(route, /bcrypt\.compare\(password, usuario\.password\)/);
  assert.match(route, /crearSesionLocal\(usuario\)/);
});

test('el login conserva cuentas bcrypt locales y resuelve el rol desde la base', async t => {
  const password = 'legacy-test-password';
  const passwordHash = await bcrypt.hash(password, 4);
  const warnings = [];
  t.mock.method(console, 'warn', (...args) => warnings.push(args));
  t.mock.method(supabase, 'rpc', async name => {
    assert.equal(name, 'consume_login_attempt');
    throw Object.assign(new Error('RPC missing'), { code: 'PGRST202' });
  });
  t.mock.method(supabaseAuth.auth, 'signInWithPassword', async () => ({
    data: { user: null, session: null },
    error: { message: 'Invalid login credentials' }
  }));
  t.mock.method(supabase, 'from', table => ({
    select() { return this; },
    eq() { return this; },
    async maybeSingle() {
      if (table === 'usuarios') {
        return {
          data: {
            id: 'legacy-user',
            nombre: 'Cuenta antigua',
            email: 'legacy@example.test',
            password: passwordHash,
            id_rol: 'role-from-database'
          },
          error: null
        };
      }
      return { data: { nombre_rol: 'cliente' }, error: null };
    },
    async insert() { return { error: null }; }
  }));

  const baseUrl = await startTestServer(t);
  const response = await fetch(`${baseUrl}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'legacy@example.test', password })
  });

  assert.equal(response.status, 200);
  const result = await response.json();
  assert.equal(result.usuario.id_rol, 'role-from-database');
  assert.equal(result.usuario.rol, 'cliente');
  assert.ok(result.token);
  assert.ok(result.refresh_token);
  assert.ok(warnings.some(args => args.join(' ').includes('login_rate_limit_migration.sql')));
});

test('el login usa Supabase Auth como mecanismo principal', async t => {
  t.mock.method(supabase, 'rpc', async name => {
    assert.equal(name, 'consume_login_attempt');
    return { data: { allowed: true, retry_after_seconds: 0 }, error: null };
  });
  t.mock.method(supabaseAuth.auth, 'signInWithPassword', async input => {
    assert.deepEqual(input, { email: 'auth@example.test', password: 'supabase-test-password' });
    return {
      data: {
        user: { id: 'auth-user', user_metadata: { documento: 'test-document' } },
        session: {
          access_token: 'test-access-token',
          refresh_token: 'test-refresh-token',
          expires_at: 1893456000
        }
      },
      error: null
    };
  });
  t.mock.method(supabase, 'from', table => ({
    select() { return this; },
    eq() { return this; },
    async maybeSingle() {
      return table === 'usuarios'
        ? { data: { id: 'auth-user', nombre: 'Auth User', email: 'auth@example.test', id_rol: 'role-client', telefono: null }, error: null }
        : { data: { nombre_rol: 'cliente' }, error: null };
    },
    async insert() { return { error: null }; }
  }));

  const baseUrl = await startTestServer(t);
  const response = await fetch(`${baseUrl}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'AUTH@example.test', password: 'supabase-test-password' })
  });

  assert.equal(response.status, 200);
  const result = await response.json();
  assert.equal(result.token, 'test-access-token');
  assert.equal(result.refresh_token, 'test-refresh-token');
  assert.equal(result.usuario.rol, 'cliente');
  assert.equal(result.usuario.documento, 'test-document');
});

test('la recuperación llama a Supabase Auth con la URL configurada y oculta errores del proveedor', async t => {
  const calls = [];
  const logged = [];
  t.mock.method(console, 'error', (...args) => logged.push(args));
  t.mock.method(supabaseAuth.auth, 'resetPasswordForEmail', async (...args) => {
    calls.push(args);
    return { error: { message: 'provider internal detail' } };
  });

  const baseUrl = await startTestServer(t);
  const response = await fetch(`${baseUrl}/api/auth/recover`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: ' USER@example.test ' })
  });

  assert.equal(response.status, 502);
  const result = await response.json();
  assert.deepEqual(result, { error: 'No se pudieron enviar las instrucciones. Inténtalo más tarde.' });
  assert.deepEqual(calls, [[
    'user@example.test',
    { redirectTo: process.env.PASSWORD_RESET_REDIRECT_URL }
  ]]);
  assert.doesNotMatch(JSON.stringify(result), /provider internal detail/);
  assert.doesNotMatch(JSON.stringify(logged), /provider internal detail/);
});