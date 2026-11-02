import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { runInNewContext } from 'node:vm';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

async function read(relativePath) {
    return readFile(path.join(root, relativePath), 'utf8');
}

test('el formulario de soporte conserva sus flechas y permite administrar solicitudes abiertas', async () => {
    const [html, frontend, styles] = await Promise.all([
        read('public/panel_control/cliente/dashboard.html'),
        read('public/panel_control/cliente/assets/js/cliente-solicitudes.js'),
        read('public/panel_control/cliente/assets/css/cliente-solicitudes.css')
    ]);

    assert.match(html, /id="clienteSolTipo"[\s\S]*id="clienteSolPrioridad"/);
    const selectFocus = styles.match(/\.cli-sol-form input:focus,[\s\S]*?\n\}/)?.[0];
    assert.ok(selectFocus);
    assert.match(selectFocus, /background-color:/);
    assert.doesNotMatch(selectFocus, /\bbackground:/);
    assert.match(styles, /\.cli-sol-form select \{[\s\S]*background-position:[\s\S]*cursor: pointer;/);

    assert.match(frontend, /result\.slice\(0, 2\)/);
    assert.match(frontend, /item\.estado === 'abierta'/);
    assert.match(frontend, /data-solicitud-action="edit"/);
    assert.match(frontend, /data-solicitud-action="delete"/);
    assert.match(frontend, /type="submit" data-solicitud-action="save"/);
    assert.match(frontend, /method: 'PATCH'/);
    assert.match(frontend, /method: 'DELETE'/);
    assert.match(frontend, /window\.notaireConfirm/);
    assert.match(frontend, /if \(solicitudEnCurso\)[\s\S]*if \(!force\) return solicitudEnCurso;[\s\S]*await solicitudEnCurso;/);
    assert.match(frontend, /El servidor devolvió una respuesta inválida/);
    assert.match(frontend, /esc\(item\.asunto\)/);
    assert.match(frontend, /esc\(item\.descripcion\)/);
    assert.match(frontend, /async function authenticatedFetch/);
    assert.match(frontend, /await window\.notaireRefreshSession\(\)/);
    assert.match(frontend, /response = await send\(\)/);
});

test('la sesión local de login puede renovarse y la carga espera la renovación inicial', async () => {
    const [authRoute, authGuard] = await Promise.all([
        read('src/app/routes/auth.routes.js'),
        read('public/assets/js/auth-guard.js')
    ]);

    assert.match(authRoute, /function crearSesionLocal\(usuario\)/);
    assert.match(authRoute, /token_type: 'refresh'/);
    assert.match(authRoute, /LOCAL_SESSION_MAX_AGE_SECONDS/);
    assert.match(authRoute, /ignoreExpiration: true/);
    assert.match(authRoute, /if \(!usuario\) return res\.status\(401\)/);
    assert.match(authGuard, /notaire_refresh_token'\)\s*\|\|\s*localStorage\.getItem\('notaire_token'\)/);
    assert.match(authGuard, /window\.notaireSessionReady/);
    assert.match(authGuard, /window\.notaireRefreshSession/);
});

test('carga las dos solicitudes recientes y reintenta el envío tras renovar la sesión', async () => {
    const frontend = await read('public/panel_control/cliente/assets/js/cliente-solicitudes.js');
    const state = { token: 'expired-load', refreshes: 0 };
    const calls = [];
    const elements = new Map();
    const documentListeners = {};
    const listListeners = {};
    const formListeners = {};
    const button = { disabled: false };
    const form = {
        addEventListener: (type, listener) => { formListeners[type] = listener; },
        querySelector: () => button,
        reset: () => { form.resetCalled = true; }
    };
    const list = {
        innerHTML: '',
        addEventListener: (type, listener) => { listListeners[type] = listener; }
    };
    const message = { textContent: '', className: '' };
    const item = (id, asunto) => ({
        id,
        asunto,
        descripcion: `Descripción ${id}`,
        tipo: 'otro',
        prioridad: 'media',
        estado: 'abierta',
        created_at: '2026-01-01T12:00:00.000Z'
    });
    const storedItems = [item(4, 'Más reciente'), item(3, 'Anterior'), item(2, 'No visible')];

    elements.set('clienteSolForm', form);
    elements.set('clienteSolList', list);
    elements.set('clienteSolMsg', message);
    elements.set('view-solicitudes', { classList: { contains: () => true } });
    elements.set('clienteSolTipo', { value: 'otro' });
    elements.set('clienteSolPrioridad', { value: 'media' });
    elements.set('clienteSolAsunto', { value: 'Nueva solicitud' });
    elements.set('clienteSolDescripcion', { value: 'Necesito ayuda' });

    const document = {
        addEventListener: (type, listener) => { documentListeners[type] = listener; },
        getElementById: id => elements.get(id),
        querySelector: () => null
    };
    const localStorage = { getItem: () => state.token };
    const response = (status, data) => ({
        status,
        ok: status >= 200 && status < 300,
        json: async () => data,
        clone() { return response(status, data); }
    });
    const fetch = async (url, options = {}) => {
        const token = options.headers.Authorization;
        const method = options.method || 'GET';
        calls.push({ url, method, token });
        if (url === '/api/solicitudes' && options.method === 'POST') {
            if (calls.filter(call => call.method === 'POST').length === 1) {
                return response(403, { error: 'Token inválido o expirado' });
            }
            return response(201, { id: 4 });
        }
        if (url.endsWith('/4') && method === 'PATCH') {
            const body = JSON.parse(options.body);
            storedItems[0] = { ...storedItems[0], ...body };
            return response(200, { ...storedItems[0], id: 4 });
        }
        if (method === 'GET' && calls.filter(call => call.method === 'GET').length === 1) {
            return response(403, { error: 'Token inválido o expirado' });
        }
        return response(200, storedItems);
    };
    const window = {
        notaireSessionReady: Promise.resolve(true),
        notaireRefreshSession: async () => {
            state.refreshes += 1;
            state.token = `fresh-${state.refreshes}`;
        },
        translateStaticContent: () => {},
        getCurrentLang: () => 'es'
    };

    runInNewContext(frontend, { document, window, localStorage, fetch, console, Date });
    documentListeners.DOMContentLoaded();
    await new Promise(resolve => setImmediate(resolve));

    assert.equal(state.refreshes, 1);
    assert.notEqual(calls[0].token, calls[1].token, 'la carga repetida debe usar el token renovado');
    assert.match(list.innerHTML, /Más reciente/);
    assert.match(list.innerHTML, /Anterior/);
    assert.doesNotMatch(list.innerHTML, /No visible/);

    const article = { dataset: { solicitudId: '4' } };
    const editButton = {
        dataset: { solicitudAction: 'edit' },
        closest: selector => selector === '.cli-sol-item' ? article : null
    };
    listListeners.click({
        target: { closest: () => editButton },
        preventDefault() {}
    });
    assert.match(list.innerHTML, /data-solicitud-action="save"/);

    const editSubmitButton = {
        disabled: false,
        dataset: { solicitudAction: 'save' },
        closest: selector => selector === '.cli-sol-item'
            ? article
            : selector === '.cli-sol-edit-form' ? editForm : null
    };
    const editForm = {
        dataset: { solicitudId: '4' },
        elements: {
            tipo: { value: 'solicitud_soporte' },
            prioridad: { value: 'alta' },
            asunto: { value: 'Asunto actualizado' },
            descripcion: { value: 'Descripción actualizada' }
        },
        querySelector: () => editSubmitButton,
        reportValidity: () => true
    };
    let saveDefaultPrevented = false;
    listListeners.click({
        target: { closest: () => editSubmitButton },
        preventDefault() { saveDefaultPrevented = true; }
    });
    await new Promise(resolve => setImmediate(resolve));

    const patchCall = calls.find(call => call.method === 'PATCH');
    assert.ok(patchCall, 'el clic en Guardar cambios debe enviar PATCH');
    assert.equal(saveDefaultPrevented, true);
    assert.equal(editSubmitButton.disabled, false);
    assert.match(list.innerHTML, /Asunto actualizado/);
    assert.match(list.innerHTML, /Descripción actualizada/);
    assert.equal(message.textContent, 'Solicitud actualizada correctamente.');

    const callsBeforeSubmit = calls.length;
    await formListeners.submit({
        target: form,
        preventDefault() {}
    });

    assert.equal(state.refreshes, 2);
    assert.notEqual(calls[callsBeforeSubmit].token, calls[callsBeforeSubmit + 1].token, 'el reintento de envío debe usar el token renovado');
    assert.equal(form.resetCalled, true);
    assert.equal(message.textContent, 'Solicitud enviada. Te responderemos pronto.');
    assert.match(list.innerHTML, /Asunto actualizado/);
    assert.doesNotMatch(list.innerHTML, /No visible/);
    assert.equal(button.disabled, false);
});

test('la API limita la edición y eliminación al propietario de solicitudes abiertas', async () => {
    const route = await read('src/app/routes/solicitudes.routes.js');

    assert.match(route, /router\.patch\('\/:id'/);
    assert.match(route, /router\.delete\('\/:id'/);
    assert.match(route, /req\.usuario\.rol !== 'cliente'/);
    assert.match(route, /\.eq\('usuario_id', req\.usuario\.id\)\s*\.eq\('estado', 'abierta'\)/);
    assert.match(route, /if \(!\/\^\\d\+\$\/\.test\(req\.params\.id\)\)/);
    assert.match(route, /if \(data\.estado !== 'abierta'\)[\s\S]*res\.status\(409\)/);
    assert.match(route, /accion: 'editar_solicitud'/);
    assert.match(route, /accion: 'eliminar_solicitud'/);
});
