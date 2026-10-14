import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import vm from 'node:vm';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

async function read(relativePath) {
    return readFile(path.join(root, relativePath), 'utf8');
}

test('el dashboard cliente no carga el script administrativo', async () => {
    const html = await read('public/panel_control/cliente/dashboard.html');
    assert.doesNotMatch(html, /admin-dashboard\.js/);
    assert.match(html, /assets\/js\/cliente-dashboard\.js/);
});

test('el dashboard conserva contenedores dinámicos sin metas demo', async () => {
    const html = await read('public/panel_control/cliente/dashboard.html');
    assert.match(html, /id="containerGoalsGrid"/);
    assert.match(html, /id="metasGoalsGrid"/);
    assert.match(html, /id="listaAhorrosRecientes"\><\/div>/);
    assert.doesNotMatch(html, /Viaje a Europa|Fondo de emergencia|Nueva Laptop|Casa propia/);
});

test('el backend usa las tablas canónicas de Supabase', async () => {
    const metasRoute = await read('src/app/routes/metas.routes.js');
    const transactionsRoute = await read('src/app/routes/transacciones.routes.js');
    assert.match(metasRoute, /\.from\('metas'\)/);
    assert.doesNotMatch(metasRoute, /metas_financieras/);
    assert.match(transactionsRoute, /\.from\('transacciones'\)/);
});

test('el cliente tiene estados de carga y manejo de perfil persistente', async () => {
    const clientScript = await read('public/panel_control/cliente/assets/js/cliente-dashboard.js');
    assert.match(clientScript, /data-state-loading|Cargando/);
    assert.match(clientScript, /api\/auth\/me/);
    assert.match(clientScript, /api\/transacciones/);
});

test('el panel cliente carga movimientos y permite desplazarse en móvil', async () => {
    const clientScript = await read('public/panel_control/cliente/assets/js/cliente-dashboard.js');
    const clientStyles = await read('public/panel_control/cliente/assets/css/cliente-dashboard.css');

    assert.doesNotMatch(clientScript, /cargarUltimosMovimientos\(\)/);
    assert.match(clientScript, /cargarDatosFinancieros\(\);/);
    assert.match(clientStyles, /@media \(max-width: 768px\)[\s\S]*?overflow-y: auto/);
    assert.match(clientStyles, /#views-container \{ flex: none; overflow: visible; \}/);
});

test('el login redirige según el rol recibido del backend', async () => {
    const loginScript = await read('public/auth/assets/js/login.js');
    assert.match(loginScript, /resolveUserRole\(data\.usuario\)/);
    assert.match(loginScript, /panel_control\/admin\/dashboard\.html/);
    assert.match(loginScript, /panel_control\/cliente\/dashboard\.html/);
    assert.match(loginScript, /assignedRole === 'cliente'/);
    assert.doesNotMatch(loginScript, /const assignedRole = 'cliente'/);
});

test('el frontend usa la API del mismo origen', async () => {
    const scripts = [
        'public/auth/assets/js/login.js',
        'public/auth/assets/js/register.js',
        'public/assets/js/auth-guard.js',
        'public/panel_control/cliente/assets/js/api.js',
        'public/panel_control/cliente/assets/js/cliente-dashboard.js'
    ];
    const contents = await Promise.all(scripts.map(read));
    assert.doesNotMatch(contents.join('\n'), /http:\/\/localhost:3000/);
});

test('el panel admin carga datos reales y no solo valores demo', async () => {
    const adminHtml = await read('public/panel_control/admin/dashboard.html');
    const adminScript = await read('public/panel_control/admin/assets/js/admin-live.js');
    const adminRoute = await read('src/app/routes/admin.routes.js');

    assert.match(adminHtml, /assets\/js\/admin-live\.js/);
    assert.match(adminHtml, /id="adminNetWorth"/);
    assert.match(adminScript, /\/api\/admin\/summary/);
    assert.match(adminRoute, /verificarToken/);
    assert.match(adminRoute, /verificarRoles\(\['admin'\]\)/);
    assert.match(adminRoute, /verificarRoles\(\['admin', 'empleado'\]\)/);
    assert.match(adminRoute, /\.from\('usuarios'\)/);
    assert.match(adminRoute, /\.from\('transacciones'\)/);
});

test('el panel admin no conserva datos financieros demo', async () => {
    const adminHtml = await read('public/panel_control/admin/dashboard.html');
    const adminScript = await read('public/panel_control/admin/assets/js/admin-dashboard.js');
    const adminCalendar = await read('public/panel_control/admin/assets/js/admin-dashboard-ext.js');
    const contents = `${adminHtml}\n${adminScript}\n${adminCalendar}`;

    assert.doesNotMatch(contents, /Restaurante|Viaje a Europa|Fondo de emergencia|Nueva Laptop|Casa propia/);
    assert.doesNotMatch(contents, /\$8\.750\.000|\$2\.450\.000|\$1\.240\.500|\$3\.250\.000/);
    assert.match(adminCalendar, /events: \[\]/);
});

test('el panel admin incluye gestión real de usuarios', async () => {
    const adminHtml = await read('public/panel_control/admin/dashboard.html');
    const adminUsersScript = await read('public/panel_control/admin/assets/js/admin-users.js');
    const adminRoute = await read('src/app/routes/admin.routes.js');

    assert.match(adminHtml, /data-target="view-usuarios"/);
    assert.match(adminHtml, /id="adminUsersTableBody"/);
    assert.match(adminHtml, /assets\/js\/admin-users\.js/);
    assert.match(adminUsersScript, /\/api\/admin\/users/);
    assert.match(adminRoute, /router\.get\('\/users'/);
    assert.match(adminRoute, /router\.put\('\/users\/:id\/role'/);
    assert.match(adminRoute, /No puedes cambiar tu propio rol/);
});

test('el panel admin incluye el módulo de trámites notariales', async () => {
    const adminHtml = await read('public/panel_control/admin/dashboard.html');
    const adminScript = await read('public/panel_control/admin/assets/js/admin-tramites.js');
    const adminRoute = await read('src/app/routes/admin.routes.js');
    const migration = await read('src/database/tramites_migration.sql');

    assert.match(adminHtml, /data-target="view-tramites"/);
    assert.match(adminHtml, /id="formNuevoTramite"/);
    assert.match(adminHtml, /assets\/js\/admin-tramites\.js/);
    assert.match(adminScript, /\/api\/admin\/tramites/);
    assert.match(adminRoute, /router\.get\('\/tramites'/);
    assert.match(adminRoute, /router\.post\('\/tramites'/);
    assert.match(adminRoute, /router\.put\('\/tramites\/:id'/);
    assert.match(migration, /create table if not exists public\.tramites_notariales/);
});

test('el panel admin incluye auditoría protegida', async () => {
    const adminHtml = await read('public/panel_control/admin/dashboard.html');
    const auditScript = await read('public/panel_control/admin/assets/js/admin-audit.js');
    const adminRoute = await read('src/app/routes/admin.routes.js');
    const auditService = await read('src/app/services/audit.service.js');
    const migration = await read('src/database/auditoria_migration.sql');

    assert.match(adminHtml, /data-target="view-auditoria"/);
    assert.match(adminHtml, /assets\/js\/admin-audit\.js/);
    assert.match(auditScript, /\/api\/admin\/audit/);
    assert.match(adminRoute, /router\.get\('\/audit'/);
    assert.match(adminRoute, /registrarAuditoria/);
    assert.match(auditService, /auditoria_acciones/);
    assert.match(migration, /create table if not exists public\.auditoria_acciones/);
});

test('los permisos distinguen administrador y empleado operativo', async () => {
    const guard = await read('public/assets/js/auth-guard.js');
    const login = await read('public/auth/assets/js/login.js');
    const adminRoute = await read('src/app/routes/admin.routes.js');
    assert.match(guard, /\['admin', 'empleado'\]\.includes\(userRole\)/);
    assert.match(login, /roleName === 'empleado'/);
    assert.match(adminRoute, /router\.get\('\/users', verificarOperacion/);
    assert.match(adminRoute, /router\.put\('\/users\/:id\/role', verificarAdmin/);
    assert.match(adminRoute, /router\.get\('\/audit', verificarAdmin/);
    assert.match(adminRoute, /router\.get\('\/tramites', verificarOperacion/);
});

test('el empleado ve movimientos propios sin acceso a finanzas de otros usuarios', async () => {
    const adminHtml = await read('public/panel_control/admin/dashboard.html');
    const adminScript = await read('public/panel_control/admin/assets/js/admin-live.js');
    const adminRoute = await read('src/app/routes/admin.routes.js');

    assert.match(adminHtml, /data-target="view-ingresos"/);
    assert.match(adminHtml, /data-target="view-gastos"/);
    assert.match(adminScript, /'view-usuarios', 'view-auditoria', 'view-reportes'/);
    assert.match(adminScript, /summary\.employeeScope === true/);
    assert.match(adminRoute, /transactionsQuery\.eq\('usuario_id', req\.usuario\.id\)/);
    assert.match(adminRoute, /goalsQuery\.eq\('usuario_id', req\.usuario\.id\)/);
    assert.match(adminRoute, /employeeScope: employeeSafe/);
});

test('el panel admin incluye centro de notificaciones operativas', async () => {
    const adminHtml = await read('public/panel_control/admin/dashboard.html');
    const notificationsScript = await read('public/panel_control/admin/assets/js/admin-notifications.js');
    const adminRoute = await read('src/app/routes/admin.routes.js');

    assert.match(adminHtml, /data-target="view-notificaciones"/);
    assert.match(adminHtml, /id="adminNotificationBadge"/);
    assert.match(adminHtml, /assets\/js\/admin-notifications\.js/);
    assert.match(notificationsScript, /notaire_admin_read_notifications/);
    assert.match(notificationsScript, /\/api\/admin\/notifications/);
    assert.match(adminRoute, /router\.get\('\/notifications', verificarOperacion/);
});

test('el panel admin incluye reportes exportables', async () => {
    const adminHtml = await read('public/panel_control/admin/dashboard.html');
    const reportsScript = await read('public/panel_control/admin/assets/js/admin-reports.js');
    const adminRoute = await read('src/app/routes/admin.routes.js');

    assert.match(adminHtml, /data-target="view-reportes"/);
    assert.match(adminHtml, /id="btnExportReport"/);
    assert.match(adminHtml, /assets\/js\/admin-reports\.js/);
    assert.match(reportsScript, /\/api\/admin\/reports/);
    assert.match(reportsScript, /text\/csv/);
    assert.match(adminRoute, /router\.get\('\/reports', verificarAdmin/);
});

test('la gráfica compartida suma los ingresos mensuales y calcula patrimonio acumulado', async () => {
    const source = await read('public/panel_control/assets/js/financial-chart.js');
    const context = { window: {} };
    vm.runInNewContext(source, context);

    const transactions = [
        { fecha: '2026-08-03', tipo: 'ingreso', monto: 1200000 },
        { fecha: '2026-08-05', tipo: 'gasto', monto: 200000 },
        { fecha: '2026-09-03', tipo_registro: 'ingreso', monto: 500000 }
    ];
    const now = new Date(2026, 9, 9);
    const api = context.window.NotaireFinancialChart;
    const income = api.createMonthlyTotals(transactions, 'ingreso', 6, now);
    const netWorth = api.createMonthlySeries(transactions, 6, now);

    assert.deepEqual(Array.from(income.values), [0, 0, 0, 1200000, 500000, 0]);
    assert.deepEqual(Array.from(netWorth.values), [0, 0, 0, 1000000, 1500000, 1500000]);
    const config = api.createConfig(income.labels, income.values, String, 'Ingresos');
    assert.equal(config.options.scales.y.ticks.callback(1), '$1');
});

test('las vistas cargan la gráfica compartida desde su ruta real y evitan JS obsoleto', async () => {
    const [clientHtml, adminHtml] = await Promise.all([
        read('public/panel_control/cliente/dashboard.html'),
        read('public/panel_control/admin/dashboard.html')
    ]);

    for (const html of [clientHtml, adminHtml]) {
        assert.match(html, /src="\.\.\/assets\/js\/financial-chart\.js\?v=\d+"/);
    }
    assert.match(clientHtml, /cliente-dashboard\.js\?v=\d+/);
    assert.match(adminHtml, /admin-dashboard\.js\?v=\d+/);
    assert.match(adminHtml, /admin-live\.js\?v=\d+/);
});

test('la administración edita y elimina metas mediante rutas protegidas de administrador', async () => {
    const adminScript = await read('public/panel_control/admin/assets/js/admin-live.js');
    const adminExtension = await read('public/panel_control/admin/assets/js/admin-dashboard-ext.js');
    const adminRoute = await read('src/app/routes/admin.routes.js');

    assert.match(adminScript, /\/api\/admin\/metas\//);
    assert.match(adminScript, /method: 'PUT'/);
    assert.match(adminScript, /method: 'DELETE'/);
    assert.match(adminExtension, /openModalEditarMeta\(\$\{meta\.id\}\)/);
    assert.match(adminRoute, /router\.put\('\/metas\/:id', verificarOperacion/);
    assert.match(adminRoute, /router\.delete\('\/metas\/:id', verificarOperacion/);
    assert.match(adminRoute, /req\.usuario\.rol === 'empleado'/);
    assert.match(adminRoute, /lookup\.eq\('usuario_id', req\.usuario\.id\)/);
    assert.match(adminRoute, /deletion\.eq\('usuario_id', req\.usuario\.id\)/);
    assert.match(adminRoute, /Meta no encontrada o no tienes permiso/);
    assert.match(adminScript, /HTTP \$\{response\.status\} sin JSON/);
    assert.doesNotMatch(adminScript, /response\.json\(\)\.catch\(\(\) => \(\{\}\)\)/);
});

test('las operaciones de metas del cliente reportan los IDs inexistentes en vez de aparentar éxito', async () => {
    const goalsRoute = await read('src/app/routes/metas.routes.js');
    assert.match(goalsRoute, /Meta no encontrada para este usuario/);
    assert.match(goalsRoute, /La meta ya no existe o no pertenece a este usuario/);
    assert.match(goalsRoute, /if \(!data\) return res\.status\(404\)/);
});

test('el login tiene límite de intentos y auditoría', async () => {
    const authRoute = await read('src/app/routes/auth.routes.js');
    const limiter = await read('src/app/middlewares/login-rate-limit.middleware.js');
    assert.match(authRoute, /router\.post\('\/login', loginRateLimit/);
    assert.match(authRoute, /login_exitoso/);
    assert.match(authRoute, /login_fallido/);
    assert.match(limiter, /MAX_ATTEMPTS = 5/);
    assert.match(limiter, /status\(429\)/);
    assert.match(limiter, /Retry-After/);
});

test('la seguridad incluye recuperación, cambio y renovación de sesión', async () => {
    const authRoute = await read('src/app/routes/auth.routes.js');
    const authGuard = await read('public/assets/js/auth-guard.js');
    const recovery = await read('public/auth/assets/js/olvide-password.js');
    const passwordPage = await read('public/auth/assets/js/cambiar-password.js');
    assert.match(authRoute, /router\.post\('\/recover'/);
    assert.match(authRoute, /resetPasswordForEmail/);
    assert.match(authRoute, /router\.put\('\/password'/);
    assert.match(authRoute, /updateUserById/);
    assert.match(authRoute, /router\.post\('\/refresh'/);
    assert.match(authGuard, /\/api\/auth\/refresh/);
    assert.match(recovery, /\/api\/auth\/recover/);
    assert.match(passwordPage, /\/api\/auth\/password/);
});
