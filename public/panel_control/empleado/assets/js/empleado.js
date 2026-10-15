(() => {
    'use strict';

    const OPEN_STATES = ['recibido', 'en_revision', 'pendiente'];
    const STATE_LABELS = {
        recibido: 'Recibido',
        en_revision: 'En Revisión',
        pendiente: 'Pendiente Firma',
        aprobado: 'Aprobado',
        finalizado: 'Finalizado',
        rechazado: 'Rechazado'
    };
    const VIEW_TITLES = {
        inicio: 'EMPLEADO',
        tramites: 'GESTIÓN DE TRÁMITES',
        verificaciones: 'VERIFICACIONES',
        calendario: 'CALENDARIO NOTARIAL',
        citas: 'CITAS',
        configuracion: 'CONFIGURACIÓN',
        solicitudes: 'SOLICITUDES'
    };
    const SOL_TYPES = { reporte_error: 'Reporte de error', solicitud_permiso: 'Solicitud de permiso', solicitud_soporte: 'Soporte / ayuda', otro: 'Otro' };
    const SOL_STATES = { abierta: 'Abierta', en_proceso: 'En proceso', resuelta: 'Resuelta', rechazada: 'Rechazada' };
    const MONTHS = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];

    const state = {
        user: readUser(),
        tramites: [],
        eventos: [],
        solicitudes: [],
        notifications: [],
        view: 'inicio',
        detailId: null,
        calYear: new Date().getFullYear(),
        calMonth: new Date().getMonth(),
        calSelected: toKey(new Date())
    };

    const $ = id => document.getElementById(id);

    function readUser() {
        try { return JSON.parse(localStorage.getItem('notaire_user') || '{}') || {}; } catch { return {}; }
    }

    function esc(value) {
        return String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    }

    function toKey(date) {
        const pad = n => String(n).padStart(2, '0');
        return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
    }

    function formatDate(key) {
        if (!key) return 'Sin fecha';
        const [y, m, d] = String(key).slice(0, 10).split('-');
        return y && m && d ? `${d}/${m}/${y}` : key;
    }

    function eventKey(event) {
        return String(event.fecha || event.fecha_hora || '').slice(0, 10);
    }

    function eventTime(event) {
        const time = event.hora || String(event.fecha_hora || '').slice(11, 16);
        return String(time || '').slice(0, 5);
    }

    function notify(message, ok = false) {
        const box = $('empAlert');
        box.textContent = message;
        box.classList.toggle('ok', ok);
        box.hidden = false;
        clearTimeout(notify.timer);
        notify.timer = setTimeout(() => { box.hidden = true; }, 5000);
    }

    async function api(url, options = {}) {
        const response = await fetch(url, {
            ...options,
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${localStorage.getItem('notaire_token') || ''}`,
                ...(options.headers || {})
            }
        });
        let result = {};
        try { result = await response.json(); } catch { /* respuesta sin cuerpo */ }
        if (!response.ok) throw new Error(result.detalle || result.error || `Error ${response.status}`);
        return result;
    }

    /* ---------- Datos ---------- */
    const isMine = t => state.user.id && String(t.responsable_id) === String(state.user.id);
    const isOpen = t => OPEN_STATES.includes(t.estado);
    const isActionable = t => isOpen(t) && (isMine(t) || !t.responsable_id);

    function byDeadline(a, b) {
        return String(a.fecha_limite || '9999').localeCompare(String(b.fecha_limite || '9999'));
    }

    async function loadAll() {
        const [tramites, eventos, notifications, solicitudes] = await Promise.allSettled([
            api('/api/admin/tramites'),
            api('/api/eventos'),
            api('/api/admin/notifications'),
            api('/api/solicitudes')
        ]);
        if (solicitudes.status === 'fulfilled') state.solicitudes = Array.isArray(solicitudes.value) ? solicitudes.value : [];
        if (tramites.status === 'fulfilled') state.tramites = Array.isArray(tramites.value) ? tramites.value : [];
        else notify(`No se pudieron cargar los trámites: ${tramites.reason.message}`);
        if (eventos.status === 'fulfilled') state.eventos = Array.isArray(eventos.value) ? eventos.value : [];
        if (notifications.status === 'fulfilled') state.notifications = notifications.value.items || [];
        renderAll();
    }

    /* ---------- Render ---------- */
    function badge(estado) {
        return `<span class="emp-badge ${esc(estado)}">${esc(STATE_LABELS[estado] || estado || 'Sin estado')}</span>`;
    }

    function deadlineCell(t) {
        const overdue = t.fecha_limite && isOpen(t) && t.fecha_limite < toKey(new Date());
        return `<span class="${overdue ? 'emp-overdue' : ''}">${esc(formatDate(t.fecha_limite))}</span>`;
    }

    function actionButtons(t) {
        const buttons = [`<button class="emp-btn small" type="button" data-act="detail" data-id="${esc(t.id)}">Ver Detalle</button>`];
        if (t.estado === 'pendiente' && isMine(t)) {
            buttons.push(`<button class="emp-btn small primary" type="button" data-act="sign" data-id="${esc(t.id)}">Firmar</button>`);
        } else if (isOpen(t) && !t.responsable_id) {
            buttons.push(`<button class="emp-btn small success" type="button" data-act="take" data-id="${esc(t.id)}">Tomar</button>`);
        }
        return `<div class="emp-row-actions">${buttons.join('')}</div>`;
    }

    function tramiteRows(list, emptyText) {
        if (!list.length) return `<tr><td colspan="6" class="emp-empty">${esc(emptyText)}</td></tr>`;
        return list.map(t => `
            <tr>
                <td>${esc(t.id)}</td>
                <td>${esc(t.tipo)}<br><small>${esc(t.titulo)}</small></td>
                <td>${esc(t.cliente?.nombre || 'Sin asignar')}</td>
                <td>${deadlineCell(t)}</td>
                <td>${badge(t.estado)}</td>
                <td>${actionButtons(t)}</td>
            </tr>`).join('');
    }

    function renderStats() {
        const today = toKey(new Date());
        $('statAsignados').textContent = state.tramites.filter(t => isOpen(t) && isMine(t)).length;
        $('statFirmas').textContent = state.tramites.filter(t => t.estado === 'pendiente' && isMine(t)).length;
        $('statCitas').textContent = state.eventos.filter(e => eventKey(e) === today).length;
        const pendingVerif = state.tramites.filter(t => ['recibido', 'en_revision'].includes(t.estado)).length;
        const badgeEl = $('navVerifBadge');
        badgeEl.textContent = pendingVerif;
        badgeEl.hidden = pendingVerif === 0;
    }

    function renderHome() {
        const tasks = state.tramites.filter(isActionable).sort(byDeadline).slice(0, 6);
        $('homeTasksBody').innerHTML = tramiteRows(tasks, 'No tienes tareas notariales pendientes.');
        renderDayList($('homeAgenda'), toKey(new Date()), 'No hay citas ni vencimientos para hoy.');
    }

    function dayItems(key) {
        const events = state.eventos
            .filter(e => eventKey(e) === key)
            .sort((a, b) => eventTime(a).localeCompare(eventTime(b)))
            .map(e => ({ kind: 'event', time: eventTime(e), title: e.titulo, id: e.id }));
        const deadlines = state.tramites
            .filter(t => isActionable(t) && t.fecha_limite === key)
            .map(t => ({ kind: 'deadline', title: `Vence: ${t.titulo}`, id: t.id }));
        return [...events, ...deadlines];
    }

    function renderDayList(container, key, emptyText) {
        const items = dayItems(key);
        container.innerHTML = items.length
            ? items.map(item => `<div class="emp-agenda-item ${item.kind}">${item.time ? `${esc(item.time)} - ` : ''}${esc(item.title)}</div>`).join('')
            : `<p class="emp-agenda-empty">${esc(emptyText)}</p>`;
    }

    function filteredTramites() {
        const query = $('tramitesSearch').value.trim().toLowerCase();
        const scope = $('tramitesScope').value;
        const status = $('tramitesStatus').value;
        return state.tramites.filter(t => {
            if (scope === 'mine' && !isMine(t)) return false;
            if (scope === 'sign' && !(t.estado === 'pendiente' && isMine(t))) return false;
            if (status && t.estado !== status) return false;
            const text = `${t.id} ${t.titulo} ${t.tipo} ${t.cliente?.nombre || ''}`.toLowerCase();
            return !query || text.includes(query);
        }).sort(byDeadline);
    }

    function renderTramites() {
        const list = filteredTramites();
        $('tramitesCount').textContent = `${list.length} trámite${list.length === 1 ? '' : 's'}`;
        $('tramitesBody').innerHTML = tramiteRows(list, 'No hay trámites que coincidan.');
    }

    function renderVerificaciones() {
        const list = state.tramites.filter(t => ['recibido', 'en_revision'].includes(t.estado)).sort(byDeadline);
        $('verifList').innerHTML = list.length
            ? list.map(t => `
                <div class="emp-verif">
                    <div>
                        <h4>${esc(t.titulo)} ${badge(t.estado)}</h4>
                        <p>${esc(t.tipo)} · Cliente: ${esc(t.cliente?.nombre || 'Sin asignar')} · Vence: ${esc(formatDate(t.fecha_limite))}</p>
                    </div>
                    <div class="emp-row-actions">
                        <button class="emp-btn small" type="button" data-act="detail" data-id="${esc(t.id)}">Ver Detalle</button>
                        <button class="emp-btn small success" type="button" data-act="approve" data-id="${esc(t.id)}">Aprobar y enviar a firma</button>
                        <button class="emp-btn small danger" type="button" data-act="reject" data-id="${esc(t.id)}">Rechazar</button>
                    </div>
                </div>`).join('')
            : '<p class="emp-agenda-empty">No hay trámites pendientes de verificación.</p>';
    }

    function renderCalendar() {
        $('calTitle').textContent = `${MONTHS[state.calMonth]} ${state.calYear}`;
        const first = new Date(state.calYear, state.calMonth, 1);
        const offset = (first.getDay() + 6) % 7;
        const start = new Date(state.calYear, state.calMonth, 1 - offset);
        const todayKey = toKey(new Date());
        let html = '';
        for (let i = 0; i < 42; i++) {
            const date = new Date(start.getFullYear(), start.getMonth(), start.getDate() + i);
            const key = toKey(date);
            const items = dayItems(key);
            const classes = ['emp-cal-day'];
            if (date.getMonth() !== state.calMonth) classes.push('other');
            if (key === todayKey) classes.push('today');
            if (key === state.calSelected) classes.push('selected');
            const chips = items.slice(0, 2).map(item => `<span class="emp-cal-chip ${item.kind}">${esc(item.title)}</span>`).join('');
            const more = items.length > 2 ? `<span class="emp-cal-chip">+${items.length - 2}</span>` : '';
            html += `<button type="button" class="${classes.join(' ')}" data-day="${key}"><b>${date.getDate()}</b>${chips}${more}</button>`;
        }
        $('calGrid').innerHTML = html;
        $('calDayTitle').textContent = `Agenda del ${formatDate(state.calSelected)}`;
        renderDayList($('calDayList'), state.calSelected, 'No hay citas ni vencimientos este día.');
    }

    function renderCitas() {
        const today = toKey(new Date());
        const list = state.eventos
            .filter(e => eventKey(e) >= today)
            .sort((a, b) => (eventKey(a) + eventTime(a)).localeCompare(eventKey(b) + eventTime(b)));
        $('citasCount').textContent = `${list.length} próxima${list.length === 1 ? '' : 's'}`;
        $('citasBody').innerHTML = list.length
            ? list.map(e => `
                <tr>
                    <td>${esc(formatDate(eventKey(e)))}</td>
                    <td>${esc(eventTime(e) || '--:--')}</td>
                    <td>${esc(e.titulo)}</td>
                    <td>${esc(e.nota || '')}</td>
                    <td><button class="emp-btn small danger" type="button" data-act="del-cita" data-id="${esc(e.id)}">Eliminar</button></td>
                </tr>`).join('')
            : '<tr><td colspan="5" class="emp-empty">No tienes citas próximas.</td></tr>';
    }

    function renderNotifications() {
        const items = state.notifications.slice(0, 8);
        $('bellDot').hidden = items.length === 0;
        $('bellList').innerHTML = items.length
            ? items.map(n => `<div class="emp-dropdown-item"><strong>${esc(n.title)}</strong>${esc(n.message)}<br><span>${esc(n.detail || '')}</span></div>`).join('')
            : '<p class="emp-agenda-empty">Sin notificaciones.</p>';
    }

    function renderSolicitudes() {
        $('solCount').textContent = `${state.solicitudes.length} registro${state.solicitudes.length === 1 ? '' : 's'}`;
        $('solBody').innerHTML = state.solicitudes.length
            ? state.solicitudes.map(s => `
                <tr>
                    <td>${esc(formatDate(String(s.created_at).slice(0, 10)))}</td>
                    <td>${s.rol_origen === 'cliente' ? esc(s.autor?.nombre || 'Cliente') : 'Yo (empleado)'}</td>
                    <td>${esc(SOL_TYPES[s.tipo] || s.tipo)}</td>
                    <td>${esc(s.asunto)}<br><small>${esc(s.descripcion)}</small></td>
                    <td>${esc(s.prioridad)}</td>
                    ${s.puede_responder ? `
                    <td><select class="emp-input" data-sol-estado="${esc(s.id)}">${Object.entries(SOL_STATES).map(([v, l]) => `<option value="${v}"${v === s.estado ? ' selected' : ''}>${l}</option>`).join('')}</select></td>
                    <td><input class="emp-input" data-sol-resp="${esc(s.id)}" maxlength="500" placeholder="Respuesta..." value="${esc(s.respuesta || '')}"><button class="emp-btn small primary" type="button" data-sol-save="${esc(s.id)}">Guardar</button></td>`
                    : `
                    <td><span class="emp-badge ${esc(s.estado)}">${esc(SOL_STATES[s.estado] || s.estado)}</span></td>
                    <td>${esc(s.respuesta || 'Sin respuesta aún')}</td>`}
                </tr>`).join('')
            : '<tr><td colspan="6" class="emp-empty">Aún no has enviado solicitudes.</td></tr>';
    }

    function renderAll() {
        renderStats();
        renderHome();
        renderTramites();
        renderVerificaciones();
        renderCalendar();
        renderCitas();
        renderSolicitudes();
        renderNotifications();
    }

    async function saveSolicitud(id, button) {
        button.disabled = true;
        const ok = await api(`/api/solicitudes/${encodeURIComponent(id)}`, {
            method: 'PUT',
            body: JSON.stringify({
                estado: document.querySelector(`[data-sol-estado="${id}"]`).value,
                respuesta: document.querySelector(`[data-sol-resp="${id}"]`).value
            })
        }).then(() => true, error => { notify(error.message); return false; });
        button.disabled = false;
        if (ok) { notify('Solicitud actualizada', true); await loadAll(); }
    }

    function openSolicitud() {
        $('formSolicitud').reset();
        $('solTramite').innerHTML = '<option value="">Ninguno</option>'
            + state.tramites.filter(isMine).map(t => `<option value="${esc(t.id)}">#${esc(t.id)} - ${esc(t.titulo)}</option>`).join('');
        $('modalSolicitud').hidden = false;
    }

    async function submitSolicitud(event) {
        event.preventDefault();
        const ok = await api('/api/solicitudes', {
            method: 'POST',
            body: JSON.stringify({
                tipo: $('solTipo').value,
                prioridad: $('solPrioridad').value,
                tramite_id: $('solTramite').value || null,
                asunto: $('solAsunto').value.trim(),
                descripcion: $('solDescripcion').value.trim()
            })
        }).then(() => true, error => { notify(error.message); return false; });
        if (!ok) return;
        $('modalSolicitud').hidden = true;
        notify('Solicitud enviada al administrador', true);
        await loadAll();
    }

    /* ---------- Navegación ---------- */
    function showView(name) {
        state.view = name;
        document.querySelectorAll('.emp-view').forEach(section => section.classList.toggle('active', section.id === `view-${name}`));
        document.querySelectorAll('#empNav a').forEach(link => link.classList.toggle('active', link.dataset.view === name));
        $('empTitle').textContent = VIEW_TITLES[name] || 'EMPLEADO';
        $('empSidebar').classList.remove('open');
        $('bellPanel').hidden = true;
    }

    function goTo(name, scope) {
        if (scope) $('tramitesScope').value = scope;
        showView(name);
        loadAll();
    }

    /* ---------- Acciones de trámite ---------- */
    const findTramite = id => state.tramites.find(t => String(t.id) === String(id));

    async function updateTramite(id, body, message) {
        try {
            await api(`/api/admin/tramites/${encodeURIComponent(id)}`, { method: 'PUT', body: JSON.stringify(body) });
            notify(message, true);
            await loadAll();
            return true;
        } catch (error) {
            notify(error.message);
            return false;
        }
    }

    function openDetail(id) {
        const t = findTramite(id);
        if (!t) return;
        state.detailId = t.id;
        $('detalleTitulo').textContent = `Trámite #${t.id}`;
        $('detalleBody').innerHTML = `
            <dt>Título</dt><dd>${esc(t.titulo)}</dd>
            <dt>Tipo</dt><dd>${esc(t.tipo)}</dd>
            <dt>Cliente</dt><dd>${esc(t.cliente?.nombre || 'Sin asignar')}</dd>
            <dt>Responsable</dt><dd>${esc(t.responsable?.nombre || 'Sin asignar')}</dd>
            <dt>Fecha límite</dt><dd>${esc(formatDate(t.fecha_limite))}</dd>
            <dt>Descripción</dt><dd>${esc(t.descripcion || 'Sin descripción')}</dd>`;
        $('detalleEstado').value = t.estado;
        $('btnAsignarme').hidden = isMine(t);
        $('modalDetalle').hidden = false;
    }

    async function handleAction(button) {
        const { act, id } = button.dataset;
        if (act === 'detail') return openDetail(id);
        if (act === 'del-cita') {
            if (!window.confirm('¿Eliminar esta cita?')) return;
            try {
                await api(`/api/eventos/${encodeURIComponent(id)}`, { method: 'DELETE' });
                notify('Cita eliminada', true);
                await loadAll();
            } catch (error) { notify(error.message); }
            return;
        }
        const t = findTramite(id);
        if (!t) return;
        if (act === 'sign') {
            if (!window.confirm(`¿Firmar y finalizar el trámite "${t.titulo}"?`)) return;
            await updateTramite(id, { estado: 'finalizado' }, 'Trámite firmado y finalizado');
        } else if (act === 'take') {
            await updateTramite(id, { responsable_id: state.user.id }, 'Trámite asignado a ti');
        } else if (act === 'approve') {
            await updateTramite(id, { estado: 'pendiente', responsable_id: t.responsable_id || state.user.id }, 'Verificación aprobada: pendiente de firma');
        } else if (act === 'reject') {
            if (!window.confirm(`¿Rechazar el trámite "${t.titulo}"?`)) return;
            await updateTramite(id, { estado: 'rechazado' }, 'Trámite rechazado');
        }
    }

    /* ---------- Formularios ---------- */
    async function openNuevoTramite() {
        $('formTramite').reset();
        $('modalTramite').hidden = false;
        try {
            const users = await api('/api/admin/users');
            const clients = users.filter(u => u.rol === 'cliente');
            $('tramCliente').innerHTML = '<option value="">Sin asignar</option>'
                + clients.map(u => `<option value="${esc(u.id)}">${esc(u.nombre || u.email)}</option>`).join('');
        } catch (error) { notify(`No se pudieron cargar los clientes: ${error.message}`); }
    }

    async function submitTramite(event) {
        event.preventDefault();
        const ok = await api('/api/admin/tramites', {
            method: 'POST',
            body: JSON.stringify({
                titulo: $('tramTitulo').value.trim(),
                tipo: $('tramTipo').value,
                estado: 'recibido',
                usuario_id: $('tramCliente').value || null,
                responsable_id: state.user.id || null,
                fecha_limite: $('tramFecha').value || null,
                descripcion: $('tramDescripcion').value
            })
        }).then(() => true, error => { notify(error.message); return false; });
        if (!ok) return;
        $('modalTramite').hidden = true;
        notify('Trámite creado', true);
        await loadAll();
    }

    function openCita(dateKey) {
        $('formCita').reset();
        $('citaFecha').value = dateKey || toKey(new Date());
        $('citaHora').value = '09:00';
        $('modalCita').hidden = false;
    }

    async function submitCita(event) {
        event.preventDefault();
        const ok = await api('/api/eventos', {
            method: 'POST',
            body: JSON.stringify({
                titulo: $('citaTitulo').value.trim(),
                fecha: $('citaFecha').value,
                hora: $('citaHora').value || '09:00',
                nota: $('citaNota').value,
                tipo: 'notarial'
            })
        }).then(() => true, error => { notify(error.message); return false; });
        if (!ok) return;
        $('modalCita').hidden = true;
        notify('Cita guardada', true);
        await loadAll();
    }

    async function submitPerfil(event) {
        event.preventDefault();
        try {
            const result = await api('/api/auth/me', {
                method: 'PUT',
                body: JSON.stringify({ nombre: $('cfgNombre').value, email: $('cfgEmail').value, telefono: $('cfgTelefono').value })
            });
            state.user = { ...state.user, ...result.usuario, rol: state.user.rol || 'empleado' };
            localStorage.setItem('notaire_user', JSON.stringify(state.user));
            renderProfile();
            notify('Perfil actualizado', true);
        } catch (error) { notify(error.message); }
    }

    async function submitPassword(event) {
        event.preventDefault();
        const password = $('cfgPassword').value;
        if (password !== $('cfgPassword2').value) return notify('Las contraseñas no coinciden');
        try {
            await api('/api/auth/password', { method: 'PUT', body: JSON.stringify({ password }) });
            $('formPassword').reset();
            notify('Contraseña actualizada', true);
        } catch (error) { notify(error.message); }
    }

    /* ---------- Perfil ---------- */
    function renderProfile() {
        const name = state.user.nombre || state.user.email || 'Empleado';
        const hour = new Date().getHours();
        const salute = hour < 12 ? 'Buenos días' : hour < 19 ? 'Buenas tardes' : 'Buenas noches';
        $('empGreeting').textContent = `¡${salute}, ${name.split(/\s+/)[0]} (Empleado)!`;
        $('empAvatar').textContent = name.trim().charAt(0).toUpperCase() || 'E';
        $('cfgNombre').value = state.user.nombre || '';
        $('cfgEmail').value = state.user.email || '';
        $('cfgTelefono').value = state.user.telefono || '';
    }

    /* ---------- Eventos ---------- */
    function bind() {
        $('empNav').addEventListener('click', event => {
            const link = event.target.closest('a[data-view]');
            if (!link) return;
            event.preventDefault();
            goTo(link.dataset.view);
        });
        document.body.addEventListener('click', event => {
            const go = event.target.closest('[data-go]');
            if (go) return goTo(go.dataset.go, go.dataset.scope);
            const solSave = event.target.closest('[data-sol-save]');
            if (solSave) return saveSolicitud(solSave.dataset.solSave, solSave);
            const action = event.target.closest('[data-act]');
            if (action) return handleAction(action);
            const day = event.target.closest('[data-day]');
            if (day) { state.calSelected = day.dataset.day; return renderCalendar(); }
            if (event.target.closest('[data-new-cita]')) return openCita(state.view === 'calendario' ? state.calSelected : null);
            const theme = event.target.closest('[data-theme-set]');
            if (theme) {
                localStorage.setItem('notaire_theme', theme.dataset.themeSet);
                document.documentElement.setAttribute('data-theme', theme.dataset.themeSet);
            }
            if (event.target.closest('[data-close]') || event.target.classList.contains('emp-modal')) {
                document.querySelectorAll('.emp-modal').forEach(modal => { modal.hidden = true; });
            }
            if (!event.target.closest('.emp-bell-wrap')) $('bellPanel').hidden = true;
        });

        ['tramitesSearch', 'tramitesScope', 'tramitesStatus'].forEach(id => {
            $(id).addEventListener('input', renderTramites);
            $(id).addEventListener('change', renderTramites);
        });
        $('btnNuevoTramite').addEventListener('click', openNuevoTramite);
        $('formTramite').addEventListener('submit', submitTramite);
        $('formCita').addEventListener('submit', submitCita);
        $('btnNuevaSolicitud').addEventListener('click', openSolicitud);
        $('formSolicitud').addEventListener('submit', submitSolicitud);
        $('formPerfil').addEventListener('submit', submitPerfil);
        $('formPassword').addEventListener('submit', submitPassword);

        $('btnGuardarEstado').addEventListener('click', async () => {
            const ok = await updateTramite(state.detailId, { estado: $('detalleEstado').value }, 'Estado actualizado');
            if (ok) $('modalDetalle').hidden = true;
        });
        $('btnAsignarme').addEventListener('click', async () => {
            const ok = await updateTramite(state.detailId, { responsable_id: state.user.id }, 'Trámite asignado a ti');
            if (ok) $('modalDetalle').hidden = true;
        });

        $('calPrev').addEventListener('click', () => shiftMonth(-1));
        $('calNext').addEventListener('click', () => shiftMonth(1));
        $('calToday').addEventListener('click', () => {
            const now = new Date();
            state.calYear = now.getFullYear();
            state.calMonth = now.getMonth();
            state.calSelected = toKey(now);
            renderCalendar();
        });

        $('btnBell').addEventListener('click', () => { $('bellPanel').hidden = !$('bellPanel').hidden; });
        $('btnSearch').addEventListener('click', () => {
            const input = $('empSearch');
            input.hidden = !input.hidden;
            if (!input.hidden) input.focus();
        });
        $('empSearch').addEventListener('input', event => {
            $('tramitesSearch').value = event.target.value;
            $('tramitesScope').value = 'all';
            if (state.view !== 'tramites') showView('tramites');
            renderTramites();
        });
        $('btnMenu').addEventListener('click', () => $('empSidebar').classList.toggle('open'));
        $('btnLogout').addEventListener('click', () => window.logout && window.logout());
    }

    function shiftMonth(delta) {
        const date = new Date(state.calYear, state.calMonth + delta, 1);
        state.calYear = date.getFullYear();
        state.calMonth = date.getMonth();
        renderCalendar();
    }

    document.addEventListener('DOMContentLoaded', () => {
        document.documentElement.setAttribute('data-theme', localStorage.getItem('notaire_theme') || 'notaire');
        bind();
        renderProfile();
        loadAll();
        setInterval(loadAll, 5 * 60 * 1000);
    });
})();
