import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

async function read(relativePath) {
  return readFile(path.join(root, relativePath), 'utf8');
}

test('las migraciones no conceden políticas RLS abiertas a los roles del navegador', async () => {
  const migrationPaths = [
    'src/database/supabase_rls.sql',
    'src/database/supabase_auth_migration.sql',
    'src/database/solicitudes_empleado_migration.sql',
    'src/database/tramites_migration.sql',
    'src/database/auditoria_migration.sql'
  ];
  const migrations = (await Promise.all(migrationPaths.map(read))).join('\n');

  assert.doesNotMatch(migrations, /using\s*\(\s*true\s*\)|with\s+check\s*\(\s*true\s*\)/i);
  assert.match(migrations, /as restrictive[\s\S]*?using \(false\) with check \(false\)/i);
});

test('la migración backend-only revoca acceso directo y mantiene service_role', async () => {
  const migration = await read('src/database/backend_only_access_migration.sql');

  assert.match(migration, /revoke all privileges on table[\s\S]*from public, anon, authenticated/i);
  assert.match(migration, /grant all privileges on table[\s\S]*to service_role/i);
  for (const table of ['usuarios', 'roles', 'metas', 'transacciones', 'tramites_notariales', 'solicitudes_empleado']) {
    assert.match(migration, new RegExp(`'${table}'`));
  }
  assert.match(migration, /enable row level security/i);
  assert.match(migration, /using \(false\) with check \(false\)/i);
});

test('el backend no contiene módulos legacy ni seeds de cuentas demo', async () => {
  const schema = await read('src/database/schema_sqlserver.sql');

  assert.doesNotMatch(schema, /insert\s+into\s+(?:dbo\.)?\[?usuarios\]?/i);
  for (const legacyFile of [
    'src/database/db.js',
    'src/database/db_mssql.js',
    'src/database/seed.sql'
  ]) {
    await assert.rejects(read(legacyFile), { code: 'ENOENT' });
  }
});

test('la migración de login usa buckets hasheados, RPC atómico y limpia vencidos', async () => {
  const migration = await read('src/database/login_rate_limit_migration.sql');

  assert.match(migration, /primary key \(scope, identifier_hash\)/i);
  assert.match(migration, /on conflict \(scope, identifier_hash\) do update/i);
  assert.match(migration, /delete from public\.login_rate_limit_buckets[\s\S]*window_started_at/i);
  assert.match(migration, /security definer/i);
  assert.match(migration, /grant execute[\s\S]*to service_role/i);
  assert.doesNotMatch(migration, /email\s+text|ip_address\s+inet/i);
});

test('el cleanup del cron legado tolera que pg_cron no esté instalado', async () => {
  const migration = await read('src/database/desactivar_cron_avisos_legacy.sql');

  assert.match(migration, /to_regclass\('cron\.job'\) is not null/i);
  assert.match(migration, /cron\.unschedule/);
  assert.doesNotMatch(migration, /drop table|delete from public\./i);
});

test('el repositorio ignora secretos, archivos temporales y respaldos', async () => {
  const gitignore = await read('.gitignore');

  assert.match(gitignore, /^\.env$/m);
  assert.match(gitignore, /^\.env\.\*$/m);
  assert.match(gitignore, /^!\.env\.example$/m);
  assert.match(gitignore, /^node_modules\/$/m);
  assert.match(gitignore, /^\*\.zip$/m);
  assert.match(gitignore, /^\*\.tmp$/m);
  assert.match(gitignore, /^\*\.backup$/m);
});

test('el manifiesto no depende de proveedores de correo ni cron en memoria', async () => {
  const [packageText, lockText] = await Promise.all([
    read('package.json'),
    read('package-lock.json')
  ]);
  const packageJson = JSON.parse(packageText);
  const lockJson = JSON.parse(lockText);

  assert.equal(packageJson.dependencies.resend, undefined);
  assert.equal(packageJson.dependencies['node-cron'], undefined);
  assert.equal(packageJson.scripts['email:test'], undefined);
  assert.equal(lockJson.packages['node_modules/resend'], undefined);
  assert.equal(lockJson.packages['node_modules/node-cron'], undefined);
});