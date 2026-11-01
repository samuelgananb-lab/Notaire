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

test('el dashboard conserva Soporte y Configuración dentro del contenedor de vistas', async () => {
    const [html, calculator, dashboard, dashboardExt, support, movements] = await Promise.all([
        read('public/panel_control/cliente/dashboard.html'),
        read('public/panel_control/cliente/assets/js/scientific-calculator.js'),
        read('public/panel_control/cliente/assets/js/cliente-dashboard.js'),
        read('public/panel_control/cliente/assets/js/cliente-dashboard-ext.js'),
        read('public/panel_control/cliente/assets/js/cliente-solicitudes.js'),
        read('public/panel_control/cliente/assets/js/movimientos.js')
    ]);

    assert.equal((html.match(/id="calculatorHistoryList"/g) || []).length, 1);
    assert.match(html, /id="calculatorHistoryList"[\s\S]*?<\/section>\s*<\/aside>\s*<\/div>\s*<\/div>\s*<!--[\s\S]*?-->\s*<div class="content-section" id="view-solicitudes">/);
    assert.match(html, /id="view-solicitudes"[\s\S]*id="view-configuracion"/);
    const startupHandler = dashboard.match(/document\.addEventListener\('DOMContentLoaded', \(\) => \{[\s\S]*?\n\}\);/)?.[0] || '';
    assert.doesNotMatch(startupHandler, /cargarDatosFinancieros/);
    assert.match(dashboard, /viewId === 'view-gastos' \|\| viewId === 'view-ingresos'[\s\S]*cargarDatosFinancieros\(viewId\)/);
    assert.match(dashboard, /const validSavedView = Array\.from\(navLinks\)\.some\(link => link\.getAttribute\('data-target'\) === savedView\)/);
    assert.doesNotMatch(dashboardExt, /function navigateTo\(/);
    assert.match(movements, /const datos = await fetchTransacciones\(mesElegido\);/);
    assert.doesNotMatch(movements, /btnGastos|btnIngresos|addEventListener\('click',\s*\(\)\s*=>\s*cambiarSeccion/);
    assert.doesNotMatch(html, /id="seccion-detallada"/);
    assert.match(support, /document\.querySelector\('a\[data-target="view-solicitudes"\]'\)\?\.addEventListener\('click', \(\) => void load\(\)\)/);
    assert.match(support, /view-solicitudes'\)\?\.classList\.contains\('active'\)\) void load\(\)/);
    assert.match(calculator, /addEventListener\('click', \(\) => void loadCurrencyCatalog\(\)\)/);
});

test('el respaldo de tasas traduce los parámetros internos a la ruta de Frankfurter', async () => {
    const calculator = await read('public/panel_control/cliente/assets/js/scientific-calculator.js');
    const helperSource = calculator.match(/function getFrankfurterPath\(path\) \{[\s\S]*?\n    \}/)?.[0];
    assert.ok(helperSource, 'Debe existir el adaptador de rutas de Frankfurter');
    const getFrankfurterPath = vm.runInNewContext(`(${helperSource})`, { URL, URLSearchParams, encodeURIComponent });

    assert.equal(getFrankfurterPath('/api/exchange-rates/currencies'), '/currencies');
    assert.equal(getFrankfurterPath('/api/exchange-rates/rate?base=COP&quote=USD&date=2026-10-26&refresh=1'), '/rate/COP/USD?date=2026-10-26');
    assert.throws(() => getFrankfurterPath('/api/exchange-rates/rate?base=CO&quote=USD&date=2026-10-26'), /códigos de moneda no son válidos/);
    assert.throws(() => getFrankfurterPath('/api/exchange-rates/rate?base=COP&quote=USD'), /fecha de cotización no es válida/);
});

test('los importes se agrupan visualmente y se convierten a número antes de guardarse', async () => {
    const [formatter, clientHtml, adminHtml] = await Promise.all([
        read('public/assets/js/number-input-format.js'),
        read('public/panel_control/cliente/dashboard.html'),
        read('public/panel_control/admin/dashboard.html')
    ]);
    const context = {
        Intl,
        Number,
        String,
        document: { addEventListener() {}, querySelectorAll: () => [] },
        window: {}
    };
    vm.runInNewContext(formatter, context);

    const input = {
        value: '1234567,89',
        selectionStart: 10,
        matches: selector => selector === '[data-format-number]',
        setSelectionRange(start, end) { this.selectionStart = start; this.selectionEnd = end; }
    };
    context.window.formatAmountInput(input);

    assert.equal(input.value, '1.234.567,89');
    assert.equal(context.window.parseFormattedAmount(input.value), 1234567.89);
    assert.equal(context.window.parseFormattedAmount('1.500.000'), 1500000);
    assert.match(clientHtml, /number-input-format\.js/);
    assert.match(adminHtml, /number-input-format\.js/);
    assert.doesNotMatch(clientHtml + adminHtml, /type="number"/);
});

test('el dashboard conserva contenedores dinámicos sin metas demo', async () => {
    const html = await read('public/panel_control/cliente/dashboard.html');
    assert.match(html, /id="metasGoalsGrid"/);
    assert.match(html, /id="listaAhorrosRecientes"/);
    assert.match(html, /id="view-metas"[\s\S]*id="listaAhorrosRecientes"[\s\S]*id="cfgPresupuesto"/);
    assert.doesNotMatch(html, /id="view-ahorros"|data-target="view-ahorros"/);
    assert.equal((html.match(/id="cfgPresupuesto"/g) || []).length, 1);
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

test('el fondo animado del login no crea desbordamiento en móviles', async () => {
    const loginStyles = await read('public/auth/assets/css/login.css');
    const loginHtml = await read('public/auth/login.html');

    assert.match(loginStyles, /\.background-shapes \{[^}]*overflow: clip;/);
    assert.match(loginStyles, /@media \(max-width: 520px\) \{[\s\S]*?height: auto;[\s\S]*?overflow-y: auto;/);
    assert.match(loginHtml, /assets\/css\/login\.css\?v=/);
});

test('el login informa si la API devuelve una respuesta vacía o no JSON', async () => {
    const loginScript = await read('public/auth/assets/js/login.js');
    const context = { document: { addEventListener() {} } };
    vm.runInNewContext(loginScript, context);

    await assert.rejects(
        context.parseLoginResponse({ status: 500, text: async () => '' }),
        /sin contenido \(HTTP 500\)/
    );
    await assert.rejects(
        context.parseLoginResponse({ status: 502, text: async () => '<html>Gateway error</html>' }),
        /respuesta no válida \(HTTP 502\)/
    );

    const data = await context.parseLoginResponse({
        status: 401,
        text: async () => '{"error":"Credenciales incorrectas"}'
    });
    assert.equal(data.error, 'Credenciales incorrectas');
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

test('las peticiones simultáneas reutilizan transacciones y filtran el mes solicitado', async () => {
    const apiScript = await read('public/panel_control/cliente/assets/js/api.js');
    const calls = [];
    const context = {
        localStorage: { getItem: key => key === 'notaire_token' ? 'test-token' : null },
        window: { location: {} },
        fetch: async (url, config) => {
            calls.push({ url, config });
            await new Promise(resolve => setTimeout(resolve, 0));
            return { ok: true, status: 200, json: async () => [] };
        }
    };
    vm.runInNewContext(apiScript, context);

    const [first, second] = await Promise.all([
        context.fetchTransacciones('2026-10'),
        context.fetchTransacciones('2026-10')
    ]);

    assert.deepEqual(Array.from(first), []);
    assert.deepEqual(Array.from(second), []);
    assert.equal(calls.length, 1);
    assert.match(calls[0].url, /\/api\/transacciones\?mes=2026-10$/);
    assert.equal(calls[0].config.headers.Authorization, 'Bearer test-token');
});

test('la caché acelera pestañas repetidas y se invalida después de guardar un movimiento', async () => {
    const apiScript = await read('public/panel_control/cliente/assets/js/api.js');
    const calls = [];
    const context = {
        localStorage: { getItem: key => key === 'notaire_token' ? 'test-token' : null },
        window: { location: {} },
        fetch: async (url, config) => {
            calls.push({ url, method: config.method });
            return {
                ok: true,
                status: config.method === 'POST' ? 201 : 200,
                json: async () => config.method === 'POST' ? { mensaje: 'creado' } : []
            };
        }
    };
    vm.runInNewContext(apiScript, context);

    await context.fetchTransacciones('2026-10');
    await context.fetchTransacciones('2026-10');
    assert.equal(calls.length, 1);

    await context.apiFetch('/transacciones', 'POST', { tipo: 'gasto', monto: 100 });
    await context.fetchTransacciones('2026-10');
    assert.equal(calls.length, 3);
    assert.deepEqual(calls.map(call => call.method), ['GET', 'POST', 'GET']);
});

test('los cambios directos de movimientos y metas invalidan la caché del panel', async () => {
    const [movements, dashboard] = await Promise.all([
        read('public/panel_control/cliente/assets/js/movimientos.js'),
        read('public/panel_control/cliente/assets/js/cliente-dashboard.js')
    ]);

    assert.match(movements, /if \(!res\.ok\)[\s\S]*?invalidateApiCache\(\)/);
    assert.match(movements, /if \(!response\.ok\) throw new Error\('Error al eliminar transacción'\);\s*invalidateApiCache\(\)/);
    assert.equal((dashboard.match(/invalidateApiCache\(\)/g) || []).length, 5);
});

test('las paletas, el modo claro y los controles visuales aplican y persisten sus opciones', async () => {
    const [script, html, styles, mobileStyles, requestsStyles, balanceScript] = await Promise.all([
        read('public/panel_control/cliente/assets/js/cliente-dashboard-ext.js'),
        read('public/panel_control/cliente/dashboard.html'),
        read('public/panel_control/cliente/assets/css/cliente-dashboard.css'),
        read('public/panel_control/cliente/assets/css/cliente-mobile.css'),
        read('public/panel_control/cliente/assets/css/cliente-solicitudes.css'),
        read('public/panel_control/cliente/assets/js/saldo.js')
    ]);
    const functionSource = script.match(/function setThemeSwatch\(themeName\) \{[\s\S]*?\n\}/)?.[0];
    assert.ok(functionSource, 'debe existir el manejador de selección de tema');

    const selected = [];
    const events = [];
    const swatches = ['purple', 'blue', 'emerald', 'gold', 'rose', 'gray', 'black'].map(theme => ({
        dataset: { theme },
        active: false,
        pressed: 'false',
        classList: { toggle(_name, active) { this.owner.active = active; }, owner: null },
        setAttribute(_name, value) { this.pressed = value; }
    }));
    swatches.forEach(swatch => { swatch.classList.owner = swatch; });
    const context = {
        document: {
            documentElement: { setAttribute: (_name, value) => selected.push(value) },
            querySelectorAll: () => swatches,
            dispatchEvent: event => events.push(event.type)
        },
        localStorage: { setItem: (_key, value) => selected.push(value) },
        Event: class { constructor(type) { this.type = type; } }
    };
    vm.runInNewContext(functionSource, context);

    context.setThemeSwatch('gold');
    assert.deepEqual(selected, ['gold', 'gold']);
    assert.deepEqual(events, ['notaire:palettechange']);
    assert.deepEqual(swatches.map(swatch => swatch.active), [false, false, false, true, false, false, false]);
    assert.deepEqual(swatches.map(swatch => swatch.pressed), ['false', 'false', 'false', 'true', 'false', 'false', 'false']);

    context.setThemeSwatch('amber');
    assert.equal(selected.length, 2);
    assert.equal(events.length, 1);
    context.setThemeSwatch('purple');
    assert.deepEqual(selected, ['gold', 'gold', 'purple', 'purple']);
    assert.deepEqual(swatches.map(swatch => swatch.active), [true, false, false, false, false, false, false]);
    assert.match(html, /data-theme="purple"[\s\S]*data-theme="blue"[\s\S]*data-theme="emerald"[\s\S]*data-theme="gold"[\s\S]*data-theme="rose"[\s\S]*data-theme="gray"[\s\S]*data-theme="black"/);
    assert.match(html, /Morado original/);
    assert.match(styles, /html\[data-color-palette="emerald"\]/);
    assert.match(styles, /html\[data-color-palette="rose"\]/);
    assert.match(styles, /html\[data-color-palette="purple"\]/);
    assert.match(styles, /html\[data-color-palette="gray"\]/);
    assert.match(styles, /html\[data-color-palette="gold"\]/);
    assert.match(styles, /html\[data-theme="dark"\]\[data-color-palette="black"\][\s\S]*--color-bg: #101216/);
    assert.match(styles, /html\[data-theme="dark"\]\[data-color-palette="gray"\][\s\S]*--color-bg: #181d25/);
    assert.match(styles, /html\[data-theme="dark"\]\[data-color-palette="gold"\]/);
    assert.match(styles, /html\[data-theme="dark"\]\[data-color-palette="black"\]/);
    assert.match(styles, /html\[data-theme="light"\] \.profile-name-text/);
    assert.match(styles, /html\[data-theme="light"\] \.cal-event-pill/);
    assert.match(styles, /html\[data-theme="light"\] \.hero-welcome-title span[\s\S]*-webkit-text-fill-color: var\(--color-primary\)/);
    assert.match(styles, /--color-bg: #f3f5f8/);
    assert.match(mobileStyles, /\[data-theme="light"\] #seccion-detallada input\[type="text"\][\s\S]*color: #172033 !important/);
    assert.match(script, /color:var\(--color-text-main\);\">\$\{escapeHtmlExt\(evt\.titulo\)\}/);
    assert.match(styles, /\.theme-swatch-gold/);
    assert.match(styles, /\.theme-swatch-black/);
    assert.match(styles, /html\[data-theme="light"\]\[data-color-palette="purple"\]/);
    assert.match(styles, /--color-bg: #f3f5f8/);
    assert.match(styles, /html\[data-theme="dark"\]\[data-color-palette="emerald"\]/);
    assert.match(mobileStyles, /data-theme="light"[\s\S]*mobile-bottom-nav/);
    assert.match(styles, /\.theme-swatch-purple/);
    assert.match(styles, /--color-accent-orange: var\(--color-secondary\)/);
    assert.match(styles, /#8c00ff/);
    assert.doesNotMatch(`${styles}\n${mobileStyles}\n${requestsStyles}\n${html}`, /#8a2be2|#8b5cf6/);
    assert.match(balanceScript, /notaire:palettechange/);
    assert.match(balanceScript, /chartDona\.update\(\)/);
    assert.match(script, /allowedThemes = \['purple', 'blue', 'emerald', 'gold', 'rose', 'gray', 'black'\]/);
    assert.match(script, /'emerald', 'gold', 'rose', 'gray', 'black'\]\.includes\(savedTheme\)/);
    assert.match(script, /setDisplayMode\(mode, el\)[\s\S]*data-theme', effectiveMode/);

    const displayModeSource = script.match(/function setDisplayMode\(mode, el\) \{[\s\S]*?\n\}/)?.[0];
    assert.ok(displayModeSource, 'debe existir el manejador del modo de visualización');
    const modes = ['dark', 'light', 'auto'].map(mode => ({
        id: `themeOpt${mode[0].toUpperCase()}${mode.slice(1)}`,
        active: false,
        classList: { toggle(_name, active) { this.owner.active = active; }, owner: null }
    }));
    modes.forEach(mode => { mode.classList.owner = mode; });
    const themeIcon = { className: '' };
    const modeContext = {
        document: {
            documentElement: { setAttribute: (_name, value) => { modeContext.appliedTheme = value; } },
            querySelectorAll: () => modes,
            getElementById: () => ({ querySelector: () => themeIcon }),
            dispatchEvent: event => { modeContext.lastEvent = event.type; }
        },
        localStorage: { setItem: (_key, value) => { modeContext.savedMode = value; } },
        window: { matchMedia: () => ({ matches: true }) },
        Event: class { constructor(type) { this.type = type; } }
    };
    vm.runInNewContext(displayModeSource, modeContext);
    modeContext.setDisplayMode('light', modes[1]);
    assert.equal(modeContext.appliedTheme, 'light');
    assert.equal(modeContext.savedMode, 'light');
    assert.deepEqual(modes.map(mode => mode.active), [false, true, false]);
    modeContext.setDisplayMode('auto', modes[2]);
    assert.equal(modeContext.appliedTheme, 'dark');
    assert.equal(modeContext.savedMode, 'auto');
    assert.equal(themeIcon.className, 'fas fa-sun');
    assert.equal(modeContext.lastEvent, 'notaire:palettechange');
});

test('las pestañas secundarias cargan metas, ahorros y saldo al abrirse', async () => {
    const [dashboard, metas, savings, balance, transactionRoute] = await Promise.all([
        read('public/panel_control/cliente/assets/js/cliente-dashboard.js'),
        read('public/panel_control/cliente/assets/js/metas.js'),
        read('public/panel_control/cliente/assets/js/ahorros.js'),
        read('public/panel_control/cliente/assets/js/saldo.js'),
        read('src/app/routes/transacciones.routes.js')
    ]);

    assert.doesNotMatch(dashboard.slice(0, dashboard.indexOf('function sincronizarEstadoCliente')), /cargarMetasYAhorros/);
    assert.doesNotMatch(metas, /DOMContentLoaded['"]\s*,\s*cargarMetasYAhorros/);
    assert.doesNotMatch(savings, /DOMContentLoaded['"]\s*,\s*cargarVistaAhorros/);
    assert.doesNotMatch(balance, /DOMContentLoaded['"]\s*,\s*cargarGraficoEvolucion/);
    assert.match(dashboard, /view-metas.*cargarVistaMetasAhorros/);
    assert.match(savings, /function cargarVistaMetasAhorros\(\)[\s\S]*cargarMetasYAhorros[\s\S]*cargarVistaAhorros/);
    assert.match(transactionRoute, /query\.gte\('fecha', inicioMes\)\.lt\('fecha', inicioMesSiguiente\)/);
});

test('el resumen de saldo incluye la gráfica agregada y el anillo detalla sus valores', async () => {
    const [balance, dashboardRoute, html, styles] = await Promise.all([
        read('public/panel_control/cliente/assets/js/saldo.js'),
        read('src/app/server.js'),
        read('public/panel_control/cliente/dashboard.html'),
        read('public/panel_control/cliente/assets/css/cliente-dashboard.css')
    ]);

    assert.match(dashboardRoute, /recentTransactions: recentResult\.data \|\| \[\]/);
    assert.match(dashboardRoute, /ingresosMensuales/);
    assert.match(dashboardRoute, /evolucion: createLiquidityTrend\(transacciones/);
    assert.match(balance, /await getDashboardMetrics\(\)/);
    assert.match(balance, /graficoEvolucion\.update\('none'\)/);
    assert.match(balance, /saldoDonaLegend/);
    assert.match(html, /id="saldo-dona-liquidez"/);
    assert.match(html, /id="saldoDonaLegend"/);
    assert.match(styles, /\.saldo-donut-center/);
    assert.match(styles, /\.saldo-legend-item/);
});

test('calendario, listas nativas y selector de emojis respetan el tema y son accesibles', async () => {
    const [clientHtml, adminHtml, clientCss, adminCss] = await Promise.all([
        read('public/panel_control/cliente/dashboard.html'),
        read('public/panel_control/admin/dashboard.html'),
        read('public/panel_control/cliente/assets/css/cliente-dashboard.css'),
        read('public/panel_control/admin/assets/css/admin-dashboard.css')
    ]);
    for (const html of [clientHtml, adminHtml]) {
        assert.match(html, /aria-pressed="true"/);
        assert.match(html, /aria-label="Meta general"/);
        assert.doesNotMatch(html, /data-emoji="✈️">✈️[\s\S]*data-emoji="✈️">✈️/);
    }
    assert.match(clientCss, /select option[\s\S]*background-color: var\(--color-card-bg\)/);
    assert.match(clientCss, /\.notif-opt-label:has\(input:checked\)/);
    assert.match(clientCss, /\.btn-cal-notif[\s\S]*linear-gradient/);
    assert.match(adminCss, /select option[\s\S]*background-color: var\(--color-card-bg\)/);
    assert.match(adminCss, /\.notif-opt-label:has\(input:checked\)/);
    assert.match(adminCss, /\.btn-cal-notif[\s\S]*linear-gradient/);
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

test('el empleado no tiene acceso a registros ni información de dinero', async () => {
    const adminHtml = await read('public/panel_control/admin/dashboard.html');
    const adminScript = await read('public/panel_control/admin/assets/js/admin-live.js');
    const adminRoute = await read('src/app/routes/admin.routes.js');
    const server = await read('src/app/server.js');

    assert.match(adminHtml, /class="has-submenu finance-only"/);
    assert.match(adminScript, /classList\.add\('employee-mode'\)/);
    assert.match(adminScript, /isEmployeeSession\(\)\) return;/);
    assert.match(adminRoute, /if \(employeeSafe\) \{\s*return res\.json\(\{ employeeScope: true/);
    assert.match(server, /'\/api\/transacciones', verificarToken, bloquearEmpleado/);
    assert.match(server, /'\/api\/metas', verificarToken, bloquearEmpleado/);
    assert.match(server, /'\/api\/patrimonio', verificarToken, bloquearEmpleado/);
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
    assert.match(adminRoute, /router\.put\('\/metas\/:id', verificarAdmin/);
    assert.match(adminRoute, /router\.delete\('\/metas\/:id', verificarAdmin/);
    assert.match(adminRoute, /Meta no encontrada/);
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

test('recuperar contraseña comparte la identidad visual y completa el flujo de restablecimiento', async () => {
    const [loginHtml, recoveryHtml, recoveryStyles, recoveryScript, passwordHtml, passwordScript, clientHtml, adminHtml, employeeHtml, authRoute, authGuard, clientLogout, adminLogout] = await Promise.all([
        read('public/auth/login.html'),
        read('public/auth/olvide-password.html'),
        read('public/auth/assets/css/olvide-password.css'),
        read('public/auth/assets/js/olvide-password.js'),
        read('public/auth/cambiar-password.html'),
        read('public/auth/assets/js/cambiar-password.js'),
        read('public/panel_control/cliente/dashboard.html'),
        read('public/panel_control/admin/dashboard.html'),
        read('public/panel_control/empleado/dashboard.html'),
        read('src/app/routes/auth.routes.js'),
        read('public/assets/js/auth-guard.js'),
        read('public/panel_control/cliente/assets/js/cliente-dashboard-ext.js'),
        read('public/panel_control/admin/assets/js/admin-dashboard-ext.js')
    ]);

    assert.match(loginHtml, /href="olvide-password\.html" class="forgot-link"/);
    assert.match(recoveryHtml, /class="main-logo"/);
    assert.match(recoveryHtml, /class="shape shape-3"/);
    assert.match(recoveryHtml, /id="recoveryForm"/);
    assert.match(recoveryHtml, /id="recoveryResult"/);
    assert.match(recoveryHtml, /href="login\.html" class="back-link"/);
    assert.match(recoveryStyles, /\.shape-1 \{[\s\S]*?width: 500px;[\s\S]*?top: -10%;[\s\S]*?left: -10%;/);
    assert.match(recoveryStyles, /33% \{ transform: translate\(40px, -60px\) scale\(1\.1\); \}/);
    assert.match(recoveryStyles, /\.shape-3 \{[\s\S]*?opacity: 0\.05;[\s\S]*?animation-delay: -12s;/);
    assert.match(recoveryStyles, /\.recovery-card \{[\s\S]*?animation: card-in 0\.45s ease-out both;[\s\S]*?transition: transform 0\.6s/);
    assert.match(recoveryStyles, /@keyframes card-in \{\s*from \{ opacity: 0; transform: translateY\(14px\) scale\(0\.98\); \}\s*to \{ opacity: 1; transform: none; \}\s*\}/);
    assert.match(recoveryStyles, /id="windParticles"|#windParticles/);
    assert.match(recoveryStyles, /recovery-card[\s\S]*?backdrop-filter: blur\(35px\)/);
    assert.match(recoveryScript, /\/api\/auth\/recover/);
    assert.match(recoveryScript, /card\.addEventListener\('mousemove'/);
    assert.match(recoveryScript, /card\.addEventListener\('mouseleave'/);
    assert.match(recoveryScript, /No se pudo conectar con el servidor/);
    assert.match(authRoute, /if \(error\) \{[\s\S]*?status\(502\)\.json\(\{ error: 'No se pudieron enviar las instrucciones/);
    assert.match(authRoute, /PASSWORD_RESET_REDIRECT_URL/);
    assert.match(passwordHtml, /id="windParticles"/);
    assert.match(passwordHtml, /assets\/js\/olvide-password\.js/);
    assert.match(passwordHtml, /<\/form>\s*<p class="form-status" id="formStatus"/);
    assert.match(passwordScript, /getElementById\('formStatus'\)/);
    assert.match(passwordScript, /queryParams\.get\('access_token'\)/);
    assert.match(passwordScript, /hashParams\.get\('access_token'\)/);
    assert.match(passwordScript, /Authorization: `Bearer \$\{recoveryToken\}`/);
    assert.match(passwordScript, /sessionStorage\.removeItem\('notaire_password_reset_token'\)/);
    assert.match(clientHtml, /onclick="openPasswordChangeDialog\(\)"/);
    assert.match(adminHtml, /onclick="openPasswordChangeDialog\(\)"/);
    assert.match(clientHtml + adminHtml + employeeHtml, /auth-guard\.js\?v=20261026-password-dialog1/);
    assert.match(authGuard, /window\.openPasswordChangeDialog = function\(\)/);
    assert.match(authGuard, /fetch\('\/api\/auth\/password'/);
    assert.match(authGuard, /id = 'notaireAppDialog'/);
    assert.match(authGuard, /dialog\.showModal\(\)/);
    assert.match(clientLogout, /window\.logout\(\)/);
    assert.match(adminLogout, /window\.logout\(\)/);
    assert.doesNotMatch(clientLogout + adminLogout, /confirm\('¿Seguro que deseas cerrar sesión\?/);
});

test('elimina metas del resumen principal y registra las aportaciones recientes', async () => {
    const [dashboard, savings, goalsRoute] = await Promise.all([
        read('public/panel_control/cliente/assets/js/cliente-dashboard.js'),
        read('public/panel_control/cliente/assets/js/ahorros.js'),
        read('src/app/routes/metas.routes.js')
    ]);

    assert.match(dashboard, /async function eliminarMetaReal[\s\S]*?await cargarPanelInicio\(\)/);
    assert.match(savings, /apiFetch\('\/metas\/aportes'\)/);
    assert.doesNotMatch(savings, /catch\(\(\) => null\)/);
    assert.match(goalsRoute, /router\.get\('\/aportes'/);
    assert.match(goalsRoute, /\.from\('aportes_meta'\)[\s\S]*?\.order\('fecha', \{ ascending: false \}\)/);
});

test('guarda y recupera teléfono y documento del perfil del usuario', async () => {
    const [dashboard, html, authRoute] = await Promise.all([
        read('public/panel_control/cliente/assets/js/cliente-dashboard.js'),
        read('public/panel_control/cliente/dashboard.html'),
        read('src/app/routes/auth.routes.js')
    ]);

    assert.match(dashboard, /JSON\.stringify\(\{ nombre, email, telefono, documento \}\)/);
    assert.match(dashboard, /documento: usuario\.documento \|\| ''/);
    assert.match(authRoute, /documento: authData\.user\.user_metadata\?\.documento \|\| ''/);
    assert.match(authRoute, /user_metadata: userMetadata/);
    assert.match(authRoute, /documento\s*\n\s*\};/);
    assert.match(html, /id="perfilTelefono"><\/div>/);
    assert.match(html, /id="perfilDocumento"><\/div>/);
});

test('el idioma traduce etiquetas estáticas y el tema alterna sin manejadores duplicados', async () => {
    const [i18n, dashboard] = await Promise.all([
        read('public/assets/js/notaire-i18n.js'),
        read('public/panel_control/cliente/assets/js/cliente-dashboard.js')
    ]);

    assert.match(i18n, /staticTextEnglish/);
    assert.match(i18n, /translateStaticContent\(lang\)/);
    assert.match(i18n, /'Progreso de metas': 'Goal progress'/);
    assert.match(i18n, /'Ahorros recientes': 'Recent savings'/);
    assert.match(i18n, /function getCurrentTheme\(\)[\s\S]*saved === 'dark'/);
    assert.match(i18n, /const next = current === 'light' \? 'dark' : 'light'/);
    assert.equal((i18n.match(/themeBtn\.addEventListener\('click'/g) || []).length, 1);
    assert.doesNotMatch(dashboard, /initThemeToggle\(\)/);
});

test('la traducción del panel conserva los textos que escribió el usuario', async () => {
    const i18n = await read('public/assets/js/notaire-i18n.js');
    const nodes = [
        { data: 'Inicio', parentElement: { closest: () => null } },
        { data: 'Meta para vacaciones', parentElement: { closest: selector => selector.includes('[data-user-content="true"]') ? {} : null } }
    ];
    let index = 0;
    const context = {
        document: {
            addEventListener() {},
            body: {},
            createTreeWalker: () => ({ nextNode: () => nodes[index++] || null }),
            querySelectorAll: () => []
        },
        window: {}
    };
    vm.runInNewContext(i18n, context);

    context.window.translateStaticContent('en');
    assert.equal(nodes[0].data, 'Home');
    assert.equal(nodes[1].data, 'Meta para vacaciones');
});

test('la página de ahorros muestra el tip solicitado y los emojis caben en una fila desplazable', async () => {
    const [html, styles, i18n] = await Promise.all([
        read('public/panel_control/cliente/dashboard.html'),
        read('public/panel_control/cliente/assets/css/cliente-dashboard.css'),
        read('public/assets/js/notaire-i18n.js')
    ]);

    assert.match(html, /Ahorros<\/span>/);
    assert.match(html, /id="ahorroTipTitle">Tip<\/h4>/);
    assert.match(html, /No trabajes solo por dinero; construye algo que genere valor incluso cuando tú no estés trabajando\./);
    assert.match(i18n, /tipText: 'No trabajes solo por dinero; construye algo que genere valor incluso cuando tú no estés trabajando\.'/);
    assert.match(html, /data-target="view-metas"><i class="fas fa-piggy-bank"><\/i> <span>Ahorros<\/span>/);
    assert.match(html, /data-nav="view-metas"><i class="fas fa-piggy-bank"><\/i><span>Ahorros<\/span>/);
    assert.match(html, /fas fa-piggy-bank/);
    assert.match(html, /class="tip-icon-glow" aria-hidden="true">💡<\/div>/);
    assert.match(i18n, /tipTitle: 'Tip'/);
    const budgetMarkup = html.match(/<div class="budget-categories-list"[\s\S]*?id="budgetCategoryAdd"/)?.[0] || '';
    assert.match(budgetMarkup, /data-emoji="🏠"/);
    assert.match(budgetMarkup, /data-emoji="🍽️"/);
    assert.match(budgetMarkup, /class="budget-cat-edit"/);
    assert.match(budgetMarkup, /class="budget-cat-emoji-picker"/);
    assert.match(budgetMarkup, /class="budget-cat-name"[^>]*readonly/);
    assert.match(budgetMarkup, /class="budget-cat-input"[^>]*readonly/);
    assert.doesNotMatch(budgetMarkup, /budget-cat-track/);
    assert.match(styles, /\.emoji-picker-row \{[^}]*flex-wrap: nowrap;[^}]*overflow-x: auto/s);
    assert.match(styles, /\*::-webkit-scrollbar-thumb \{[^}]*linear-gradient/s);
    assert.match(styles, /\.tip-content h4 \{[^}]*text-align: center/);
});

test('actividad reciente muestra solo ingresos y gastos y elimina el acceso adicional a gastos', async () => {
    const [html, homeScript, styles, server] = await Promise.all([
        read('public/panel_control/cliente/dashboard.html'),
        read('public/panel_control/cliente/assets/js/inicio.js'),
        read('public/panel_control/cliente/assets/css/cliente-dashboard.css'),
        read('src/app/server.js')
    ]);

    assert.match(html, /id="listaActividadReciente"/);
    assert.doesNotMatch(html, /onclick="navigateTo\('view-gastos'\)">Ver gastos/);
    assert.match(homeScript, /\.filter\(transaccion => \['ingreso', 'gasto'\]\.includes\(normalizarTipo\(transaccion\)\)\)/);
    assert.match(homeScript, /transaction-title">\$\{esIngreso \? 'Ingreso' : 'Gasto'\}/);
    assert.match(homeScript, /\.slice\(0, 5\)/);
    assert.match(homeScript, /obtenerMovimientosRecientes\(dashboardData, normalizarTipo\)/);
    assert.match(homeScript, /await fetchTransacciones\(\)/);
    assert.match(homeScript, /No se pudieron cargar los movimientos recientes\./);
    assert.match(server, /\.from\('transacciones'\)[\s\S]*?\.limit\(5\)/);
    assert.match(styles, /\[data-theme="light"\] \.config-toggle-title/);
    assert.match(styles, /\[data-theme="light"\] \.section-title-group h2/);
    assert.match(styles, /\[data-theme="light"\] \.goal-title-text/);
    assert.match(styles, /\[data-theme="light"\] \.month-title-select/);
});

test('actividad reciente se refresca al guardar o eliminar desde movimientos', async () => {
    const movementsScript = await read('public/panel_control/cliente/assets/js/movimientos.js');
    assert.equal(
        (movementsScript.match(/if \(typeof cargarPanelInicio === 'function'\) await cargarPanelInicio\(\);/g) || []).length,
        2
    );
});

test('actividad reciente usa la API de transacciones cuando el resumen no incluye movimientos', async () => {
    const homeScript = await read('public/panel_control/cliente/assets/js/inicio.js');
    const helperSource = homeScript.match(/async function obtenerMovimientosRecientes\(dashboardData, normalizarTipo\) \{[\s\S]*?\n\}/)?.[0];
    assert.ok(helperSource);

    let fallbackCalls = 0;
    const fallbackTransactions = [
        { id: 5, tipo: 'ingreso', monto: 2500 },
        { id: 4, tipo: 'ahorro', monto: 300 },
        { id: 3, tipo: 'gasto', monto: 800 }
    ];
    const obtener = vm.runInNewContext(`(${helperSource})`, {
        fetchTransacciones: async () => {
            fallbackCalls += 1;
            return fallbackTransactions;
        }
    });
    const tipo = transaction => transaction.tipo;

    assert.deepEqual(
        await obtener({ recentTransactions: [] }, tipo),
        [fallbackTransactions[0], fallbackTransactions[2]]
    );
    assert.equal(fallbackCalls, 1);
    assert.deepEqual(
        await obtener({ recentTransactions: [fallbackTransactions[0]] }, tipo),
        [fallbackTransactions[0]]
    );
    assert.equal(fallbackCalls, 1);
});

test('el logo y el avatar quedan centrados al colapsar el menú lateral', async () => {
    const [html, styles] = await Promise.all([
        read('public/panel_control/cliente/dashboard.html'),
        read('public/panel_control/cliente/assets/css/cliente-dashboard.css')
    ]);

    assert.match(html, /<text x="50" y="50" dominant-baseline="central"[^>]*text-anchor="middle">N<\/text>/);
    assert.match(styles, /\.sidebar\.collapsed \.brand-header \{[^}]*display: grid;[^}]*justify-items: center/s);
    assert.match(styles, /\.sidebar\.collapsed \.brand-logo-hex \{[^}]*justify-self: center/s);
    assert.match(styles, /\.sidebar\.collapsed \.sidebar-profile \{[^}]*display: grid;[^}]*place-items: center;[^}]*width: 100%;/s);
    assert.match(styles, /\.sidebar\.collapsed \.sidebar-profile \.profile-avatar-circle \{[^}]*flex: 0 0 42px;[^}]*width: 42px;[^}]*height: 42px;/s);
    assert.match(styles, /\.profile-avatar-circle \{[^}]*aspect-ratio: 1;/s);
    assert.match(styles, /\.sidebar\.collapsed \.sidebar-toggle-btn \{[^}]*margin: 0 auto/s);
    assert.match(styles, /\.sidebar \{[^}]*transition: width 0\.42s cubic-bezier\(0\.22, 1, 0\.36, 1\)/s);
});

test('el panel cliente tiene centro de notificaciones, avisos periódicos y navegación priorizada', async () => {
    const [html, notifications, mobileNav, mobileStyles, styles, preferenceService, eventNotifications, financeAlerts] = await Promise.all([
        read('public/panel_control/cliente/dashboard.html'),
        read('public/panel_control/cliente/assets/js/cliente-dashboard-ext.js'),
        read('public/panel_control/cliente/assets/js/mobile-nav.js'),
        read('public/panel_control/cliente/assets/css/cliente-mobile.css'),
        read('public/panel_control/cliente/assets/css/cliente-dashboard.css'),
        read('src/app/services/notification-prefs.service.js'),
        read('src/app/services/event-notifications.service.js'),
        read('src/app/services/finance-alerts.service.js')
    ]);

    const destinations = [...html.matchAll(/data-target="(view-[^"]+)"/g)].map(match => match[1]);
    assert.deepEqual(destinations.slice(0, 9), [
        'view-inicio', 'view-gastos', 'view-ingresos', 'view-saldo', 'view-metas',
        'view-calculadora', 'view-recordatorios', 'view-solicitudes', 'view-configuracion'
    ]);
    assert.match(html, /id="notificationBell"[\s\S]{0,300}fa-bell/);
    assert.match(html, /id="notificationPanel"/);
    assert.match(styles, /background-image: linear-gradient\(var\(--color-card-bg\), var\(--color-card-bg\)\)/);
    assert.match(html, /id="togNotifDaily"/);
    assert.match(html, /id="togNotifMonthly"/);
    assert.match(notifications, /notaire_notification_center/);
    assert.match(notifications, /dedupeKey: `daily:/);
    assert.match(notifications, /dedupeKey: `monthly:/);
    assert.match(notifications, /dedupeKey: `event:/);
    assert.match(mobileNav, /view-calculadora/);
    assert.match(mobileNav, /let lastSyncedView = null/);
    assert.match(mobileNav, /if \(lastSyncedView === view\) return/);
    assert.match(mobileNav, /container\.querySelectorAll\('\.content-section'\)\.forEach\(section =>/);
    assert.doesNotMatch(mobileNav, /attributeFilter: \['class'\],[\s\S]{0,40}subtree: true/);
    assert.match(styles, /@media \(max-width: 768px\)[\s\S]*?\.calculator-workspace \{ grid-template-columns: minmax\(0, 1fr\)/);
    assert.match(styles, /@media \(max-width: 768px\)[\s\S]*?\.notification-panel \{ top: 68px/);
    assert.match(styles, /@media \(max-width: 768px\)[\s\S]*?\.sidebar \{ z-index: 70; \}/);
    assert.match(styles, /\.mobile-sidebar-backdrop \{ z-index: 65; \}/);
    assert.match(mobileStyles, /\.mobile-bottom-nav/);
    assert.match(mobileNav, /document\.getElementById\('mobileMenuTrigger'\)\?\.click\(\)/);
    assert.match(preferenceService, /daily: bool\('daily'\)/);
    assert.match(preferenceService, /monthly: bool\('monthly'\)/);
    assert.match(notifications, /if \(!response\.ok\) throw new Error\(`El servidor respondió HTTP \$\{response\.status\}`\)/);
    assert.match(notifications, /input\.checked = await requestBrowserNotifications\(\)/);
    assert.match(eventNotifications, /evento\.fecha\}T\$\{String\(evento\.hora \|\| '08:00'\)\.slice\(0, 5\)\}:00-05:00/);
    assert.match(eventNotifications, /T09:00:00-05:00/);
    assert.match(financeAlerts, /timezone: 'America\/Bogota'/);
    assert.match(financeAlerts, /\.lt\('fecha', endExclusive\)/);

    const minutesUntilSource = eventNotifications.match(/function minutesUntil\(evento, now = Date\.now\(\)\) \{[\s\S]*?\n\}/)?.[0];
    assert.ok(minutesUntilSource);
    const minutesUntil = vm.runInNewContext(`(${minutesUntilSource})`, { Date });
    assert.equal(minutesUntil(
        { fecha: '2026-10-27', hora: '08:00:00' },
        Date.parse('2026-10-27T12:00:00.000Z')
    ), 60);
});

test('las opciones de notificación reflejan permisos del navegador y errores de sincronización', async () => {
    const notifications = await read('public/panel_control/cliente/assets/js/cliente-dashboard-ext.js');
    const elements = new Map([
        ['togNotifBrowser', { checked: false }],
        ['togNotif24h', { checked: true }],
        ['togNotif1h', { checked: true }],
        ['togNotifGastos', { checked: true }],
        ['togNotifSemanal', { checked: false }],
        ['togNotifDaily', { checked: true }],
        ['togNotifMonthly', { checked: true }]
    ]);
    const stored = new Map([['notaire_token', 'test-token']]);
    const toasts = [];
    const loggedErrors = [];
    const notificationApi = {
        permission: 'denied',
        async requestPermission() { return this.permission; }
    };
    const context = {
        document: {
            addEventListener() {},
            getElementById: id => elements.get(id) || null,
            querySelectorAll: () => []
        },
        window: { Notification: notificationApi, getCurrentLang: () => 'es' },
        Notification: notificationApi,
        localStorage: {
            getItem: key => stored.get(key) || null,
            setItem: (key, value) => stored.set(key, value)
        },
        fetch: async () => ({ ok: false, status: 503 }),
        showToast: message => toasts.push(message),
        console: { error: (...args) => loggedErrors.push(args) }
    };
    vm.runInNewContext(notifications, context);

    const normalizedEvent = vm.runInNewContext(
        `normalizeCalendarEvent({ id: 1, fecha: '2026-10-27', hora: '08:00:00', notifonday: true })`,
        context
    );
    assert.equal(normalizedEvent.hora, '08:00');
    assert.equal(normalizedEvent.notifOnDay, true);

    const browserToggle = elements.get('togNotifBrowser');
    browserToggle.checked = true;
    await vm.runInContext('toggleNotifBrowser(document.getElementById("togNotifBrowser"))', context);
    assert.equal(browserToggle.checked, false);
    assert.equal(JSON.parse(stored.get('notaire_notif_cfg')).browser, false);
    assert.ok(!toasts.some(message => message.includes('activadas')));

    notificationApi.permission = 'granted';
    browserToggle.checked = true;
    await vm.runInContext('toggleNotifBrowser(document.getElementById("togNotifBrowser"))', context);
    assert.equal(browserToggle.checked, true);
    assert.equal(JSON.parse(stored.get('notaire_notif_cfg')).browser, true);

    await vm.runInContext('saveNotifConfig()', context);
    assert.ok(toasts.some(message => message.includes('no se sincronizaron')));
    assert.ok(loggedErrors.length > 0);
});

test('el presupuesto se sincroniza por cuenta y las cuentas nuevas empiezan en cero', async () => {
    const [preferences, dashboard, dashboardExt, registration] = await Promise.all([
        read('src/app/services/notification-prefs.service.js'),
        read('public/panel_control/cliente/dashboard.html'),
        read('public/panel_control/cliente/assets/js/cliente-dashboard-ext.js'),
        read('public/auth/assets/js/register.js')
    ]);

    const normalizerSource = preferences.match(/function normalizeBudgetCategories\(value\) \{[\s\S]*?\n\}/)?.[0];
    assert.ok(normalizerSource, 'Debe existir normalización de categorías del presupuesto');
    const normalizeBudgetCategories = vm.runInNewContext(`(${normalizerSource})`, { Array, Number, String });
    assert.deepEqual(
        JSON.parse(JSON.stringify(normalizeBudgetCategories([
            { id: ' food ', name: 'Alimentación', emoji: '🍽️', value: 123000, priority: 2 },
            { id: '', name: 'Inválida', value: 10 }
        ]))),
        [{ id: 'food', name: 'Alimentación', emoji: '🍽️', value: 123000, priority: 2 }]
    );
    assert.match(preferences, /presupuesto_categorias: normalizeBudgetCategories\(source\.presupuesto_categorias\)/);
    assert.match(dashboardExt, /async function saveBudgetConfig\(\)/);
    assert.match(dashboardExt, /await persistirPreferencias\(\{[\s\S]*presupuesto_categorias: categories,[\s\S]*presupuesto_categorias_version: DEFAULT_BUDGET_CATEGORY_ORDER_VERSION/);
    assert.match(dashboardExt, /presupuesto_categorias: legacyCategories/);
    assert.match(dashboardExt, /hasSavedCategories && !saved && row\.dataset\.budgetCategory !== 'savings'/);
    assert.match(dashboard, /id="cfgPresupuesto" value="0"/);
    assert.equal((dashboard.match(/class="budget-cat-input" value="0"/g) || []).length, 5);
    const categories = [...dashboard.matchAll(/data-budget-category="([^"]+)"/g)].map(match => match[1]);
    assert.deepEqual(categories, ['services', 'food', 'transport', 'savings', 'entertainment']);
    assert.match(registration, /localStorage\.removeItem\('notaire_presupuesto_categorias'\)/);
});

test('el dashboard restaura la vista activa después de recargar', async () => {
    const [dashboard, registration] = await Promise.all([
        read('public/panel_control/cliente/assets/js/cliente-dashboard.js'),
        read('public/auth/assets/js/register.js')
    ]);

    assert.match(dashboard, /sessionStorage\.getItem\('notaire_cliente_active_view'\)/);
    assert.match(dashboard, /sessionStorage\.setItem\('notaire_cliente_active_view', viewId\)/);
    assert.match(dashboard, /sessionStorage\.removeItem\('notaire_cliente_active_view'\)/);
    assert.match(registration, /sessionStorage\.removeItem\('notaire_cliente_active_view'\)/);
});

test('el calendario cambia de vista y el error de aporte solo muestra el límite', async () => {
    const [html, calendar, dashboard, styles, register] = await Promise.all([
        read('public/panel_control/cliente/dashboard.html'),
        read('public/panel_control/cliente/assets/js/cliente-dashboard-ext.js'),
        read('public/panel_control/cliente/assets/js/cliente-dashboard.js'),
        read('public/panel_control/cliente/assets/css/cliente-dashboard.css'),
        read('public/auth/register.html')
    ]);
    const aporteError = dashboard.match(/function mostrarErrorAporte\(info\) \{[\s\S]*?\n\}/)?.[0] || '';

    assert.match(html, /id="calendarMonthPicker"/);
    assert.match(html, /id="calViewWeek"/);
    assert.match(html, /id="calViewDay"/);
    assert.match(html, /id="btnUpcomingAll"/);
    assert.match(calendar, /CalendarState\.viewMode === 'week' \? 7 : 1/);
    assert.match(calendar, /CalendarState\.upcomingExpanded \? upcoming\.length : 5/);
    assert.match(styles, /\.calendar-month-grid\.is-day-view \{ grid-template-columns: minmax\(0, 1fr\); \}/);
    assert.match(styles, /@media \(max-width: 768px\)[\s\S]*?\.calendar-month-grid\.is-day-view/);
    assert.doesNotMatch(html, /id="seccion-detallada"/);
    assert.match(aporteError, /box\.textContent = message/);
    assert.doesNotMatch(aporteError, /createElement|openModalRegistrarIngreso|aporte-error-actions/);
    assert.match(register, /assets\/css\/login\.css/);
});

test('el calendario guarda categorías compatibles y muestra los días en su propia franja', async () => {
    const [html, calendar, route, migration, databaseGuide, styles, mobileStyles] = await Promise.all([
        read('public/panel_control/cliente/dashboard.html'),
        read('public/panel_control/cliente/assets/js/cliente-dashboard-ext.js'),
        read('src/app/routes/eventos.routes.js'),
        read('src/database/eventos_calendario_tipo_migration.sql'),
        read('docs/guia_base_de_datos.md'),
        read('public/panel_control/cliente/assets/css/cliente-dashboard.css'),
        read('public/panel_control/cliente/assets/css/cliente-mobile.css')
    ]);

    assert.match(route, /const EVENT_TYPES = new Set\(\['notarial', 'financiero', 'recordatorio', 'personal', 'cumpleanos'\]\)/);
    assert.match(route, /EVENT_TYPE_ALIASES\[tipo\] \|\| tipo \|\| 'notarial'/);
    assert.match(route, /normalizeEventType\(tipo\)/);
    assert.match(route, /eventos_calendario_tipo_check/);
    assert.match(migration, /drop constraint if exists eventos_calendario_tipo_check/);
    assert.match(migration, /check \(tipo in \('notarial', 'financiero', 'recordatorio', 'personal', 'cumpleanos'\)\)\s+not valid/);
    assert.match(databaseGuide, /eventos_calendario_tipo_migration\.sql/);
    assert.match(html, /id="calendarWeekdays"[\s\S]*Dom[\s\S]*Lun[\s\S]*Sáb/);
    assert.doesNotMatch(html, /calendar-legend-tags|calendarMonthPicker"[^>]*type="month"/);
    assert.match(calendar, /WEEKDAY_NAMES\[window\.getCurrentLang/);
    assert.match(calendar, /calendarMonthApply/);
    assert.match(calendar, /calendarEventError/);
    assert.match(styles, /\.calendar-month-picker\[hidden\] \{ display: none; \}/);
    assert.match(styles, /\.calendar-event-modal \{/);
    assert.match(mobileStyles, /\.calendar-weekday-grid \{ grid-template-columns: repeat\(7, minmax\(0, 1fr\)\)/);
});

test('las metas completadas se separan y las tres más avanzadas se destacan', async () => {
    const [goals, dashboard] = await Promise.all([
        read('public/panel_control/cliente/assets/js/metas.js'),
        read('public/panel_control/cliente/dashboard.html')
    ]);
    const statsSource = goals.match(/function resumirMetas\(metas\) \{[\s\S]*?\n\}/)?.[0];
    assert.ok(statsSource);
    const metaSource = goals.match(/function resumirMeta\(meta\) \{[\s\S]*?\n\}/)?.[0];
    assert.ok(metaSource);
    const resumen = vm.runInNewContext(`${metaSource}\n${statsSource}\nresumirMetas`, { String, Number, Math });
    const resumirMeta = vm.runInNewContext(`${metaSource}\nresumirMeta`, { String, Number, Math });
    const results = resumen([
        { id: 1, monto_actual: 90, monto_objetivo: 100, fecha_limite: '2027-01-01' },
        { id: 2, monto_actual: 80, monto_objetivo: 100, fecha_limite: '2027-02-01' },
        { id: 3, monto_actual: 70, monto_objetivo: 100, fecha_limite: '2027-03-01' },
        { id: 4, monto_actual: 50, monto_objetivo: 100, fecha_limite: '2027-04-01' },
        { id: 5, monto_actual: 100, monto_objetivo: 100, fecha_limite: '2027-05-01' }
    ]);

    assert.equal(results.activas.length, 4);
    assert.equal(results.completadas.length, 1);
    assert.equal(results.progresoPromedio, 78);
    assert.deepEqual(Array.from(results.proximas, goal => goal.meta.id), [1, 2, 3]);
    assert.equal(resumirMeta({ monto_actual: 25, monto_objetivo: 25 }).completada, true);
    assert.match(dashboard, /id="valMetasCompletadas"/);
    assert.match(dashboard, /id="metasProximasGrid"/);
    assert.match(goals, /class="goal-card\$\{goal\.completada \? ' is-completed' : ''\}"/);
});

test('las acciones de metas usan controles coherentes y accesibles sin iconos emoji', async () => {
    const [goals, styles] = await Promise.all([
        read('public/panel_control/cliente/assets/js/metas.js'),
        read('public/panel_control/cliente/assets/css/cliente-dashboard.css')
    ]);
    assert.match(goals, /class="goal-card-actions"/);
    assert.match(goals, /class="goal-card-icon-action"[^>]*aria-label="\$\{english \? 'Edit goal' : 'Editar meta'\}"/);
    assert.match(goals, /class="goal-card-icon-action is-danger"[^>]*aria-label="\$\{english \? 'Delete goal' : 'Eliminar meta'\}"/);
    assert.doesNotMatch(goals, /class="btn-delete-goal"/);
    assert.match(styles, /\.goal-card-icon-action \{[\s\S]*?border-radius: 12px/);
});

test('la calculadora científica evalúa operaciones y funciones trigonométricas sin eval', async () => {
    const [calculator, html, i18n, styles] = await Promise.all([
        read('public/panel_control/cliente/assets/js/scientific-calculator.js'),
        read('public/panel_control/cliente/dashboard.html'),
        read('public/assets/js/notaire-i18n.js'),
        read('public/panel_control/cliente/assets/css/cliente-dashboard.css')
    ]);
    assert.match(html, /<h2>CALCULADORA<\/h2>/);
    const keypadMarkup = html.match(/<div class="calculator-keypad"[\s\S]*?<\/div>/)?.[0] || '';
    assert.equal((keypadMarkup.match(/class="calculator-key(?:\s|")/g) || []).length, 48);
    assert.match(keypadMarkup, /data-action="second"/);
    assert.match(keypadMarkup, /data-action="memory-clear"/);
    assert.match(keypadMarkup, /data-action="memory-add"/);
    assert.match(keypadMarkup, /data-action="memory-subtract"/);
    assert.match(keypadMarkup, /data-action="memory-recall"/);
    assert.match(keypadMarkup, /data-transform="nth-root"/);
    assert.match(keypadMarkup, /data-value="sinh\("/);
    assert.match(keypadMarkup, /data-action="random"/);
    assert.match(html, /class="calculator-history card-box"[\s\S]*id="calculatorHistoryList"/);
    assert.match(html, /class="calculator-side-panel"[\s\S]*id="currencyConverterTitle"[\s\S]*id="calculatorHistoryList"/);
    assert.match(html, /id="currencyFrom"/);
    assert.match(html, /id="currencyTo"/);
    assert.match(html, /id="currencySwap"/);
    assert.match(html, /id="currencyAmountFrom"/);
    assert.match(html, /id="currencyAmountTo"/);
    assert.match(calculator, /\/api\/exchange-rates\/currencies/);
    assert.match(calculator, /\/api\/exchange-rates\/rate\?\$\{params\}/);
    assert.match(calculator, /new URLSearchParams\(\{ base, quote, date: localRateDate\(\) \}\)/);
    assert.match(calculator, /fetchCurrencyData/);
    assert.match(calculator, /https:\/\/api\.frankfurter\.dev\/v2/);
    assert.match(calculator, /externalPath === '\/currencies' && Array\.isArray\(data\)/);
    assert.match(calculator, /code: currency\.iso_code/);
    assert.match(calculator, /formatToParts\(1234\.5\)/);
    assert.match(html, /id="calculatorMemoryIndicator"/);
    assert.match(styles, /\.calculator-keypad \{[\s\S]*grid-template-columns: repeat\(8, minmax\(0, 1fr\)\);[\s\S]*grid-template-rows: repeat\(6, minmax\(44px, 1fr\)\)/);
    assert.match(styles, /@media \(max-width: 1000px\)[\s\S]*?\.calculator-workspace \{ grid-template-columns: minmax\(0, 1fr\); \}/);
    assert.match(i18n, /'view-calculadora': 'CALCULADORA'/);
    const elements = new Map();
    const inverseTrigButton = {
        dataset: { label: 'sin', altLabel: 'sin⁻¹' },
        textContent: 'sin',
        setAttribute(name, value) { this.attributes[name] = value; },
        attributes: {}
    };
    const makeElement = () => ({
        textContent: '',
        dataset: {},
        tagName: 'DIV',
        attributes: {},
        listeners: {},
        classList: {
            add(value) { this[value] = true; },
            remove(value) { delete this[value]; }
        },
        addEventListener(type, handler) { this.listeners[type] = handler; },
        setAttribute(name, value) { this.attributes[name] = value; },
        append() {},
        replaceChildren() {},
        querySelectorAll(selector) {
            return selector === '[data-alt-value]' ? [inverseTrigButton] : [];
        }
    });
    for (const id of ['scientificCalculator', 'calculatorExpression', 'calculatorResult', 'calculatorKeypad', 'calculatorAngleMode', 'calculatorHistoryList', 'calculatorClearHistory']) {
        elements.set(id, makeElement());
    }
    const storage = new Map();
    const context = {
        document: {
            getElementById: id => elements.get(id),
            createElement: () => makeElement(),
            addEventListener() {}
        },
        window: {},
        localStorage: {
            getItem: key => storage.get(key) || null,
            setItem: (key, value) => storage.set(key, value)
        },
        console
    };
    vm.runInNewContext(calculator, context);

    const keypad = elements.get('calculatorKeypad');
    const result = elements.get('calculatorResult');
    const press = dataset => {
        const button = {
            dataset,
            textContent: dataset.label || '',
            setAttribute(name, value) { this.attributes[name] = value; },
            attributes: {}
        };
        keypad.listeners.click({ target: { closest: () => button } });
        return button;
    };
    const enter = value => press({ value });

    enter('2');
    enter('+');
    assert.equal(result.textContent, '');
    enter('3');
    enter('*');
    enter('4');
    press({ action: 'equals' });
    assert.equal(result.textContent, '14');
    assert.equal(JSON.parse(storage.values().next().value).length, 1);

    press({ action: 'clear' });
    enter('sin(');
    enter('3');
    enter('0');
    enter(')');
    press({ action: 'equals' });
    assert.equal(Number(result.textContent).toFixed(2), '0.50');

    press({ action: 'clear' });
    enter('2');
    enter('-');
    enter('3');
    press({ action: 'equals' });
    assert.equal(result.textContent, '-1');
    assert.equal(JSON.parse(storage.values().next().value).length, 3);

    const calculateTokens = tokens => {
        press({ action: 'clear' });
        tokens.forEach(token => enter(token));
        press({ action: 'equals' });
        return result.textContent;
    };
    assert.equal(calculateTokens(['ln(', '3', '6']), '3.58351893846');
    assert.equal(calculateTokens(['log(', '1', '0', '0']), '2');
    assert.equal(calculateTokens(['sqrt(', '8', '1']), '9');
    assert.equal(calculateTokens(['cos(', '9', '0']), '0');
    assert.equal(calculateTokens(['tan(', '4', '5']), '1');
    assert.equal(calculateTokens(['asin(', '0', '.', '5']), '30');
    assert.equal(calculateTokens(['acos(', '0', '.', '5']), '60');
    assert.equal(calculateTokens(['atan(', '1']), '45');
    assert.equal(calculateTokens(['abs(', '-', '5']), '5');
    assert.equal(calculateTokens(['5', '!']), '120');
    assert.equal(calculateTokens(['2', '^', '3']), '8');
    assert.equal(calculateTokens(['2', '^', '-', '2']), '0.25');
    assert.equal(calculateTokens(['-', '2', '^', '2']), '-4');
    assert.equal(calculateTokens(['2', '(', '3', '+', '4', ')']), '14');
    assert.equal(calculateTokens(['2', 'pi']), '6.28318530718');
    assert.equal(calculateTokens(['e', '^', '1']), '2.71828182846');
    assert.equal(calculateTokens(['5', '0', '%']), '0.5');
    assert.equal(calculateTokens(['sinh(', '0']), '0');
    assert.equal(calculateTokens(['cosh(', '0']), '1');
    assert.equal(calculateTokens(['tanh(', '0']), '0');
    assert.equal(calculateTokens(['asinh(', '1']), '0.88137358702');
    assert.equal(calculateTokens(['acosh(', '1']), '0');
    assert.equal(calculateTokens(['atanh(', '0']), '0');
    assert.equal(calculateTokens(['powten(', '3']), '1000');
    assert.equal(calculateTokens(['exp(', '1']), '2.71828182846');
    assert.equal(calculateTokens(['1', 'e', '3']), '1000');
    assert.equal(calculateTokens(['3', 'e', '-', '2']), '0.03');
    assert.equal(calculateTokens(['2', '7', '^', '(', '1', '/', '3', ')']), '3');
    press({ action: 'clear' });
    press({ action: 'second' });
    assert.equal(inverseTrigButton.textContent, 'sin⁻¹');
    press({ value: 'sin(', altValue: 'asin(' });
    enter('0.5');
    press({ action: 'equals' });
    assert.equal(result.textContent, '30');
    press({ action: 'second' });
    assert.equal(inverseTrigButton.textContent, 'sin');
    assert.equal(calculateTokens(['1', '2']), '12');
    press({ action: 'delete' });
    press({ action: 'equals' });
    assert.equal(result.textContent, '1');
    const angleButton = elements.get('calculatorAngleMode');
    angleButton.listeners.click();
    assert.equal(calculateTokens(['sin(', 'pi', '/', '2']), '1');
    angleButton.listeners.click();
    assert.equal(calculateTokens(['tan(', '9', '0']), 'Resultado no definido');

    press({ action: 'clear' });
    enter('9');
    press({ action: 'sign' });
    press({ action: 'equals' });
    assert.equal(result.textContent, '-9');

    press({ action: 'clear' });
    enter('4');
    press({ transform: 'reciprocal' });
    press({ action: 'equals' });
    assert.equal(result.textContent, '0.25');

    press({ action: 'clear' });
    enter('3');
    press({ transform: 'square' });
    press({ action: 'equals' });
    assert.equal(result.textContent, '9');

    press({ action: 'clear' });
    press({ action: 'random' });
    press({ action: 'equals' });
    assert.ok(Number(result.textContent) >= 0 && Number(result.textContent) < 1);

    press({ action: 'clear' });
    enter('2');
    enter('+');
    enter('3');
    press({ action: 'memory-add' });
    press({ action: 'clear' });
    press({ action: 'memory-recall' });
    press({ action: 'equals' });
    assert.equal(result.textContent, '5');
    press({ action: 'memory-clear' });

    press({ action: 'clear' });
    enter('2');
    enter('7');
    press({ transform: 'nth-root' });
    enter('3');
    press({ action: 'equals' });
    assert.equal(result.textContent, '3');

    press({ action: 'clear' });
    enter('3');
    press({ action: 'ee' });
    enter('2');
    press({ action: 'equals' });
    assert.equal(result.textContent, '300');

    elements.get('calculatorClearHistory').listeners.click();
    assert.deepEqual(JSON.parse(storage.values().next().value), []);
    assert.doesNotMatch(calculator, /\beval\s*\(/);
});

test('el presupuesto permite agregar, editar y priorizar categorías', async () => {
    const [html, dashboard, styles] = await Promise.all([
        read('public/panel_control/cliente/dashboard.html'),
        read('public/panel_control/cliente/assets/js/cliente-dashboard-ext.js'),
        read('public/panel_control/cliente/assets/css/cliente-dashboard.css')
    ]);
    assert.match(html, /id="budgetCategoryAdd"[^>]*>[\s\S]*Agregar categoría/);
    assert.match(html, /class="budget-cat-name"/);
    assert.match(html, /class="budget-cat-priority"/);
    assert.match(html, /Elige la prioridad, pulsa el emoji para cambiarlo y usa Editar para modificar el nombre o monto\./);
    assert.match(dashboard, /function createBudgetCategoryRow\(category\)/);
    assert.match(dashboard, /function populateBudgetEmojiPicker\(row\)/);
    assert.match(dashboard, /function initializeBudgetCategoryRow\(row/);
    assert.match(dashboard, /category\.emoji/);
    assert.match(dashboard, /notaire_presupuesto_categorias/);
    assert.match(dashboard, /priority: Number\(row\.querySelector\('\.budget-cat-priority'\)/);
    assert.match(dashboard, /budget-cat-remove/);
    assert.match(styles, /\.budget-category-add \{/);
    assert.match(styles, /\.budget-cat-priority \{/);
    assert.match(styles, /\.budget-cat-emoji-picker\[hidden\] \{ display: none; \}/);
    assert.match(styles, /\.budget-cat-emoji-picker \{[^}]*background-image: linear-gradient\(var\(--color-card-bg\), var\(--color-card-bg\)\)/);
    assert.match(styles, /@media \(max-width: 768px\)[\s\S]*?html, body \{ overflow-y: auto; \}/);
    assert.match(styles, /#views-container \{[\s\S]*?min-height: 0;[\s\S]*?overflow-y: scroll;/);
    assert.match(styles, /#views-container::-webkit-scrollbar \{ width: 9px; \}/);
    assert.match(dashboard, /categoryTotalBaseline/);
    assert.match(dashboard, /syncBudgetTotalFromCategories/);
    assert.match(dashboard, /event\.target\.matches\('\.budget-cat-input'\)\) syncBudgetTotalFromCategories\(\)/);
    assert.match(dashboard, /removeButton\.closest\('\.budget-cat-row'\)\?\.remove\(\);\s*syncBudgetTotalFromCategories\(\)/);

    const adjustmentFunction = dashboard.match(/function calculateBudgetTotalAfterCategoryChange\(currentBudget, categoryTotal, previousCategoryTotal\) \{[\s\S]*?\n\}/)?.[0];
    assert.ok(adjustmentFunction);
    const calculateAdjustedBudget = vm.runInNewContext(`${adjustmentFunction}; calculateBudgetTotalAfterCategoryChange`);
    assert.equal(calculateAdjustedBudget(1500000, 1300100, 1300000), 1500100);
    assert.equal(calculateAdjustedBudget(1500000, 1299900, 1300000), 1499900);
    assert.equal(calculateAdjustedBudget(50, 0, 100), 0);
});

test('el botón de tema alterna repetidamente entre oscuro y claro', async () => {
    const i18n = await read('public/assets/js/notaire-i18n.js');
    const attributes = new Map();
    const values = new Map([['notaire_theme', 'dark'], ['notaire_lang', 'es']]);
    const themeButton = {
        innerHTML: '',
        attributes: {},
        setAttribute(name, value) { this.attributes[name] = value; }
    };
    const context = {
        document: {
            documentElement: {
                setAttribute(name, value) { attributes.set(name, value); },
                getAttribute(name) { return attributes.get(name) || null; }
            },
            addEventListener() {},
            dispatchEvent() {},
            getElementById: id => id === 'themeToggleBtn' ? themeButton : null,
            querySelectorAll: () => []
        },
        localStorage: {
            getItem: key => values.get(key) || null,
            setItem: (key, value) => values.set(key, value)
        },
        window: { matchMedia: () => ({ matches: true }) },
        Event: class {},
        setInterval() {}
    };
    vm.runInNewContext(i18n, context);

    context.window.toggleTheme();
    assert.equal(attributes.get('data-theme'), 'light');
    assert.equal(values.get('notaire_theme'), 'light');
    context.window.toggleTheme();
    assert.equal(attributes.get('data-theme'), 'dark');
    assert.equal(values.get('notaire_theme'), 'dark');
    assert.match(themeButton.innerHTML, /fa-moon/);
});
