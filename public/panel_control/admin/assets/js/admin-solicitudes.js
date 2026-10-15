(() => {
    const URL_SOLICITUDES = '/api/solicitudes';
    const TYPES = { reporte_error: 'Reporte de error', solicitud_permiso: 'Solicitud de permiso', solicitud_soporte: 'Soporte / ayuda', otro: 'Otro' };
    const STATES = { abierta: 'Abierta', en_proceso: 'En proceso', resuelta: 'Resuelta', rechazada: 'Rechazada' };
    let items = [];

    const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    const headers = () => ({ 'Content-Type': 'application/json', Authorization: `Bearer ${localStorage.getItem('notaire_token') || ''}` });

    function render() {
        const body = document.getElementById('adminSolicitudesBody');
        const filter = document.getElementById('adminSolicitudesFilter')?.value || '';
        const list = items.filter(item => !filter || item.estado === filter);
        document.getElementById('adminSolicitudesCount').textContent = `${list.length} solicitud${list.length === 1 ? '' : 'es'}`;
        const open = items.filter(item => item.estado === 'abierta').length;
        const badge = document.getElementById('adminSolicitudesBadge');
        if (badge) { badge.textContent = open; badge.style.display = open ? '' : 'none'; }

        if (!list.length) {
            body.innerHTML = '<tr><td colspan="8" class="admin-users-state">No hay solicitudes.</td></tr>';
            return;
        }
        body.innerHTML = list.map(item => `
            <tr>
                <td>${esc(new Date(item.created_at).toLocaleString('es-CO'))}</td>
                <td>${esc(item.autor?.nombre || item.autor?.email || 'Usuario')} <small>(${esc(item.rol_origen)})</small></td>
                <td>${esc(TYPES[item.tipo] || item.tipo)}</td>
                <td><strong>${esc(item.asunto)}</strong><br><small>${esc(item.descripcion)}</small></td>
                <td>${esc(item.prioridad)}</td>
                <td>
                    <select class="admin-role-select" data-sol-estado="${esc(item.id)}">
                        ${Object.entries(STATES).map(([value, label]) => `<option value="${value}"${value === item.estado ? ' selected' : ''}>${label}</option>`).join('')}
                    </select>
                </td>
                <td><input class="admin-role-select" data-sol-resp="${esc(item.id)}" maxlength="500" placeholder="Respuesta..." value="${esc(item.respuesta || '')}"></td>
                <td><button class="btn-primary-action" type="button" data-sol-save="${esc(item.id)}">Guardar</button></td>
            </tr>`).join('');
    }

    async function load() {
        const body = document.getElementById('adminSolicitudesBody');
        if (!body) return;
        try {
            const response = await fetch(URL_SOLICITUDES, { headers: headers() });
            const result = await response.json().catch(() => []);
            if (!response.ok) throw new Error(result.error || result.detalle || 'No se pudieron cargar las solicitudes');
            items = Array.isArray(result) ? result : [];
            render();
        } catch (error) {
            body.innerHTML = `<tr><td colspan="8" class="admin-users-state">${esc(error.message)}</td></tr>`;
        }
    }

    async function save(id, button) {
        const estado = document.querySelector(`[data-sol-estado="${id}"]`).value;
        const respuesta = document.querySelector(`[data-sol-resp="${id}"]`).value;
        button.disabled = true;
        try {
            const response = await fetch(`${URL_SOLICITUDES}/${encodeURIComponent(id)}`, {
                method: 'PUT', headers: headers(), body: JSON.stringify({ estado, respuesta })
            });
            const result = await response.json().catch(() => ({}));
            if (!response.ok) throw new Error(result.error || result.detalle || 'No se pudo guardar');
            await load();
        } catch (error) {
            window.alert(error.message);
        } finally {
            button.disabled = false;
        }
    }

    document.addEventListener('DOMContentLoaded', () => {
        load();
        document.getElementById('btnRefreshSolicitudes')?.addEventListener('click', load);
        document.getElementById('adminSolicitudesFilter')?.addEventListener('change', render);
        document.querySelector('#sidebarMenu a[data-target="view-solicitudes"]')?.addEventListener('click', load);
        document.getElementById('adminSolicitudesBody')?.addEventListener('click', event => {
            const button = event.target.closest('[data-sol-save]');
            if (button) save(button.dataset.solSave, button);
        });
    });
})();
