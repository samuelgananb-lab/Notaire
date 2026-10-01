const ADMIN_TRAMITES_URL = '/api/admin/tramites';
let adminTramites = [];

function escapeTramite(value) {
    return String(value ?? '').replace(/[&<>"']/g, character => ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;'
    }[character]));
}

function tramiteRequest(url, options = {}) {
    const token = localStorage.getItem('notaire_token');
    return fetch(url, {
        ...options,
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}`, ...(options.headers || {}) }
    }).then(async response => {
        const result = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(result.detalle || result.error || 'No se pudo completar la operación');
        return result;
    });
}

function tramiteStatusLabel(status) {
    return ({
        recibido: 'Recibido',
        en_revision: 'En revisión',
        pendiente: 'Pendiente',
        aprobado: 'Aprobado',
        finalizado: 'Finalizado',
        rechazado: 'Rechazado'
    }[status] || status || 'Sin estado');
}

function renderAdminTramites() {
    const body = document.getElementById('adminTramitesTableBody');
    const count = document.getElementById('adminTramitesCount');
    if (!body) return;

    const query = String(document.getElementById('adminTramitesSearch')?.value || '').trim().toLowerCase();
    const status = document.getElementById('adminTramitesStatusFilter')?.value || '';
    const filtered = adminTramites.filter(tramite => {
        const text = `${tramite.titulo || ''} ${tramite.tipo || ''} ${tramite.cliente?.nombre || ''}`.toLowerCase();
        return (!query || text.includes(query)) && (!status || tramite.estado === status);
    });
    if (count) count.textContent = `${filtered.length} trámite${filtered.length === 1 ? '' : 's'}`;

    if (!filtered.length) {
        body.innerHTML = '<tr><td colspan="6" class="admin-users-state">No hay trámites que coincidan.</td></tr>';
        return;
    }

    body.innerHTML = filtered.map(tramite => `
        <tr>
            <td><span class="admin-user-name">${escapeTramite(tramite.titulo)}</span><br><small>${escapeTramite(tramite.tipo)}</small></td>
            <td>${escapeTramite(tramite.cliente?.nombre || 'Sin asignar')}</td>
            <td>${escapeTramite(tramite.responsable?.nombre || 'Sin asignar')}</td>
            <td><select class="admin-role-select admin-tramite-status" data-tramite-id="${escapeTramite(tramite.id)}">
                ${['recibido', 'en_revision', 'pendiente', 'aprobado', 'finalizado', 'rechazado'].map(state => `<option value="${state}" ${state === tramite.estado ? 'selected' : ''}>${tramiteStatusLabel(state)}</option>`).join('')}
            </select></td>
            <td>${escapeTramite(tramite.fecha_limite || 'Sin fecha')}</td>
            <td><button class="btn-tx-delete" type="button" title="Eliminar" data-delete-tramite="${escapeTramite(tramite.id)}"><i class="fas fa-trash"></i></button></td>
        </tr>
    `).join('');

    body.querySelectorAll('.admin-tramite-status').forEach(select => select.addEventListener('change', () => updateTramiteStatus(select)));
    body.querySelectorAll('[data-delete-tramite]').forEach(button => button.addEventListener('click', () => deleteTramite(button.dataset.deleteTramite)));
}

async function loadAdminTramites() {
    const body = document.getElementById('adminTramitesTableBody');
    if (!body) return;
    body.innerHTML = '<tr><td colspan="6" class="admin-users-state">Cargando trámites...</td></tr>';
    try {
        const result = await tramiteRequest(ADMIN_TRAMITES_URL);
        adminTramites = Array.isArray(result) ? result : [];
        renderAdminTramites();
    } catch (error) {
        body.innerHTML = `<tr><td colspan="6" class="admin-users-state">${escapeTramite(error.message)}</td></tr>`;
    }
}

async function loadTramiteUsers() {
    try {
        const users = await tramiteRequest('/api/admin/users');
        ['tramiteCliente', 'tramiteResponsable'].forEach(id => {
            const select = document.getElementById(id);
            if (!select) return;
            select.innerHTML = '<option value="">Sin asignar</option>' + users.map(user => `<option value="${escapeTramite(user.id)}">${escapeTramite(user.nombre || user.email)}</option>`).join('');
        });
    } catch (error) {
        console.error('No se pudieron cargar usuarios para el trámite:', error);
    }
}

async function updateTramiteStatus(select) {
    select.disabled = true;
    try {
        await tramiteRequest(`${ADMIN_TRAMITES_URL}/${encodeURIComponent(select.dataset.tramiteId)}`, {
            method: 'PUT',
            body: JSON.stringify({ estado: select.value })
        });
    } catch (error) {
        window.alert(error.message);
        await loadAdminTramites();
    } finally {
        select.disabled = false;
    }
}

async function deleteTramite(id) {
    if (!window.confirm('¿Eliminar este trámite?')) return;
    try {
        await tramiteRequest(`${ADMIN_TRAMITES_URL}/${encodeURIComponent(id)}`, { method: 'DELETE' });
        await loadAdminTramites();
    } catch (error) { window.alert(error.message); }
}

function openNewTramite() {
    document.getElementById('formNuevoTramite')?.reset();
    document.getElementById('modalNuevoTramite')?.classList.add('active');
    loadTramiteUsers();
}

async function createTramite(event) {
    event.preventDefault();
    try {
        await tramiteRequest(ADMIN_TRAMITES_URL, {
            method: 'POST',
            body: JSON.stringify({
                titulo: document.getElementById('tramiteTitulo').value,
                tipo: document.getElementById('tramiteTipo').value,
                usuario_id: document.getElementById('tramiteCliente').value || null,
                responsable_id: document.getElementById('tramiteResponsable').value || null,
                estado: document.getElementById('tramiteEstado').value,
                fecha_limite: document.getElementById('tramiteFechaLimite').value || null,
                descripcion: document.getElementById('tramiteDescripcion').value
            })
        });
        document.getElementById('modalNuevoTramite').classList.remove('active');
        await loadAdminTramites();
    } catch (error) { window.alert(error.message); }
}

document.addEventListener('DOMContentLoaded', () => {
    loadAdminTramites();
    document.getElementById('btnNewTramite')?.addEventListener('click', openNewTramite);
    document.getElementById('formNuevoTramite')?.addEventListener('submit', createTramite);
    document.querySelectorAll('[data-close-tramite]').forEach(button => button.addEventListener('click', () => document.getElementById('modalNuevoTramite')?.classList.remove('active')));
    document.getElementById('adminTramitesSearch')?.addEventListener('input', renderAdminTramites);
    document.getElementById('adminTramitesStatusFilter')?.addEventListener('change', renderAdminTramites);
    document.querySelector('#sidebarMenu a[data-target="view-tramites"]')?.addEventListener('click', loadAdminTramites);
});
