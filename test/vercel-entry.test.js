import assert from 'node:assert/strict';
import test from 'node:test';
import app from '../index.js';
import { supabase } from '../src/app/database/supabase.js';

test('el entrypoint Express conserva frontend, health y rutas de autenticación', async t => {
  t.mock.method(supabase, 'from', table => {
    assert.equal(table, 'usuarios');
    return {
      select() {
        return this;
      },
      async limit() {
        return { error: null };
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

  const address = server.address();
  const baseUrl = `http://127.0.0.1:${address.port}`;

  const frontend = await fetch(`${baseUrl}/`);
  assert.equal(frontend.status, 200);
  assert.match(await frontend.text(), /Notaire - Inicio/);

  const health = await fetch(`${baseUrl}/api/health`);
  assert.equal(health.status, 200);
  assert.deepEqual(await health.json(), {
    status: 'OK',
    message: 'Conectado exitosamente a Supabase'
  });

  const authRoute = await fetch(`${baseUrl}/api/auth/registro`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: '{}'
  });
  assert.equal(authRoute.status, 400);
  assert.match((await authRoute.json()).error, /obligatorios/);
});
