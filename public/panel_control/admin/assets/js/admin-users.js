const ADMIN_USERS_URL = '/api/admin/users';
let adminUsers = [];

function escapeAdminUser(value) {
    return String(value ?? '').replace(/[&<>"']/g, character => ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;'
    }[character]));
}

function renderAdminUsers() {
    const body = document.getElementById('adminUsersTableBody');
    const count = document.getElementById('adminUsersCount');
    if (!body) return;

    const query = String(document.getElementById('adminUsersSearch')?.value || '').trim().toLowerCase();
    const filtered = adminUsers.filter(user => `${user.nombre || ''} ${user.email || ''}`.toLowerCase().includes(query));
    if (count) count.textContent = `${filtered.length} usuario${filtered.length === 1 ? '' : 's'}`;

    if (!filtered.length) {
        body.innerHTML = '<tr><td colspan="5" class="admin-users-state">No hay usuarios que coincidan.</td></tr>';
        return;
    }

    body.innerHTML = filtered.map(user => `
        <tr>
            <td><span class="admin-user-name">${escapeAdminUser(user.nombre || 'Sin nombre')}</span></td>
            <td>${escapeAdminUser(user.email)}</td>
            <td>${escapeAdminUser(user.telefono || 'Sin teléfono')}</td>
            <td>
                <select class="admin-role-select" data-user-id="${escapeAdminUser(user.id)}" data-current-role="${escapeAdminUser(user.rol)}">
                    ${['admin', 'cliente', 'empleado'].map(role => `<option value="${role}" ${role === user.rol ? 'selected' : ''}>${role}</option>`).join('')}
                </select>
            </td>
            <td><span class="admin-users-role-state">${escapeAdminUser(user.rol || 'sin rol')}</span></td>
        </tr>
    `).join('');

    body.querySelectorAll('.admin-role-select').forEach(select => {
        select.addEventListener('change', () => updateAdminUserRole(select));
    });
}

async function loadAdminUsers() {
    const token = localStorage.getItem('notaire_token');
    const body = document.getElementById('adminUsersTableBody');
    if (!token || !body) return;
    body.innerHTML = '<tr><td colspan="5" class="admin-users-state">Cargando usuarios...</td></tr>';

    try {
        const response = await fetch(ADMIN_USERS_URL, { headers: { Authorization: `Bearer ${token}` } });
        const result = await response.json().catch(() => []);
        if (!response.ok) throw new Error(result.detalle || result.error || 'No se pudieron cargar los usuarios');
        adminUsers = Array.isArray(result) ? result : [];
        renderAdminUsers();
    } catch (error) {
        body.innerHTML = `<tr><td colspan="5" class="admin-users-state">${escapeAdminUser(error.message)}</td></tr>`;
    }
}

async function updateAdminUserRole(select) {
    const userId = select.dataset.userId;
    const previousRole = select.dataset.currentRole;
    const token = localStorage.getItem('notaire_token');
    select.disabled = true;

    try {
        const response = await fetch(`${ADMIN_USERS_URL}/${encodeURIComponent(userId)}/role`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
            body: JSON.stringify({ rol: select.value })
        });
        const result = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(result.detalle || result.error || 'No se pudo actualizar el rol');
        const user = adminUsers.find(item => String(item.id) === String(userId));
        if (user) user.rol = result.usuario?.rol || select.value;
        select.dataset.currentRole = select.value;
        window.alert('Rol actualizado correctamente.');
    } catch (error) {
        select.value = previousRole;
        window.alert(error.message);
    } finally {
        select.disabled = false;
    }
}

document.addEventListener('DOMContentLoaded', () => {
    loadAdminUsers();
    document.getElementById('btnRefreshUsers')?.addEventListener('click', loadAdminUsers);
    document.getElementById('adminUsersSearch')?.addEventListener('input', renderAdminUsers);
    document.querySelector('#sidebarMenu a[data-target="view-usuarios"]')?.addEventListener('click', loadAdminUsers);
});
