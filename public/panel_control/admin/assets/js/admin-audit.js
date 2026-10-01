const ADMIN_AUDIT_URL = '/api/admin/audit';

function escapeAudit(value) {
    return String(value ?? '').replace(/[&<>"']/g, character => ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;'
    }[character]));
}

function auditActionLabel(action) {
    return ({
        cambiar_rol: 'Cambio de rol',
        crear_tramite: 'Trámite creado',
        actualizar_tramite: 'Trámite actualizado',
        eliminar_tramite: 'Trámite eliminado'
    }[action] || action || 'Acción');
}

async function loadAdminAudit() {
    const body = document.getElementById('adminAuditTableBody');
    if (!body) return;
    const token = localStorage.getItem('notaire_token');
    const action = document.getElementById('adminAuditActionFilter')?.value || '';
    body.innerHTML = '<tr><td colspan="5" class="admin-users-state">Cargando auditoría...</td></tr>';

    try {
        const url = action ? `${ADMIN_AUDIT_URL}?accion=${encodeURIComponent(action)}` : ADMIN_AUDIT_URL;
        const response = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
        const result = await response.json().catch(() => []);
        if (!response.ok) throw new Error(result.detalle || result.error || 'No se pudo cargar la auditoría');
        const entries = Array.isArray(result) ? result : [];
        const count = document.getElementById('adminAuditCount');
        if (count) count.textContent = `${entries.length} registro${entries.length === 1 ? '' : 's'}`;
        if (!entries.length) {
            body.innerHTML = '<tr><td colspan="5" class="admin-users-state">No hay acciones registradas.</td></tr>';
            return;
        }
        body.innerHTML = entries.map(entry => `
            <tr>
                <td>${escapeAudit(new Date(entry.created_at).toLocaleString('es-CO'))}</td>
                <td>${escapeAudit(entry.actor?.nombre || entry.actor?.email || 'Usuario')}</td>
                <td><span class="admin-audit-action">${escapeAudit(auditActionLabel(entry.accion))}</span></td>
                <td>${escapeAudit(entry.recurso)}${entry.recurso_id ? ` #${escapeAudit(entry.recurso_id)}` : ''}</td>
                <td><code>${escapeAudit(JSON.stringify(entry.detalles || {}))}</code></td>
            </tr>
        `).join('');
    } catch (error) {
        body.innerHTML = `<tr><td colspan="5" class="admin-users-state">${escapeAudit(error.message)}</td></tr>`;
    }
}

document.addEventListener('DOMContentLoaded', () => {
    loadAdminAudit();
    document.getElementById('btnRefreshAudit')?.addEventListener('click', loadAdminAudit);
    document.getElementById('adminAuditActionFilter')?.addEventListener('change', loadAdminAudit);
    document.querySelector('#sidebarMenu a[data-target="view-auditoria"]')?.addEventListener('click', loadAdminAudit);
});
