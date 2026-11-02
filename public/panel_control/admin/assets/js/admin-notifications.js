const ADMIN_NOTIFICATIONS_URL = '/api/admin/notifications';
let adminNotifications = [];
let adminReadNotificationIds = new Set(JSON.parse(localStorage.getItem('notaire_admin_read_notifications') || '[]'));

function escapeNotification(value) {
    return String(value ?? '').replace(/[&<>"']/g, character => ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;'
    }[character]));
}

function notificationIcon(type) {
    return ({ tramite: 'fa-file-signature', recordatorio: 'fa-clock', evento: 'fa-calendar-day', auditoria: 'fa-list-check' }[type] || 'fa-bell');
}

function notificationTypeLabel(type) {
    return ({ tramite: 'Trámite', recordatorio: 'Recordatorio', evento: 'Evento', auditoria: 'Auditoría' }[type] || 'Notificación');
}

function renderAdminNotifications() {
    const container = document.getElementById('adminNotificationsList');
    const badge = document.getElementById('adminNotificationBadge');
    const count = document.getElementById('adminNotificationsCount');
    if (!container) return;

    const filter = document.getElementById('adminNotificationFilter')?.value || '';
    const items = adminNotifications.filter(item => !filter || item.type === filter);
    const unread = adminNotifications.filter(item => !adminReadNotificationIds.has(item.id)).length;
    if (badge) badge.textContent = unread;
    if (count) count.textContent = `${items.length} alerta${items.length === 1 ? '' : 's'}`;

    if (!items.length) {
        container.innerHTML = '<div class="admin-notification-empty"><i class="fas fa-check-circle"></i><strong>Todo está al día</strong><span>No hay alertas para este filtro.</span></div>';
        return;
    }

    container.innerHTML = items.map(item => {
        const read = adminReadNotificationIds.has(item.id);
        return `
            <article class="admin-notification-card ${read ? 'is-read' : 'is-unread'}" data-notification-id="${escapeNotification(item.id)}">
                <div class="admin-notification-icon admin-notification-${escapeNotification(item.type)}"><i class="fas ${notificationIcon(item.type)}"></i></div>
                <div class="admin-notification-content">
                    <div class="admin-notification-heading"><strong>${escapeNotification(item.title)}</strong><span>${escapeNotification(notificationTypeLabel(item.type))}</span></div>
                    <p>${escapeNotification(item.message)}</p>
                    <small>${escapeNotification(item.detail)} · ${escapeNotification(item.user)} · ${escapeNotification(new Date(item.date).toLocaleString('es-CO'))}</small>
                </div>
                <button class="admin-notification-read" type="button" title="Marcar como revisada" data-read-notification="${escapeNotification(item.id)}"><i class="fas fa-check"></i></button>
            </article>
        `;
    }).join('');

    container.querySelectorAll('[data-read-notification]').forEach(button => button.addEventListener('click', () => {
        adminReadNotificationIds.add(button.dataset.readNotification);
        localStorage.setItem('notaire_admin_read_notifications', JSON.stringify([...adminReadNotificationIds]));
        renderAdminNotifications();
    }));
}

async function loadAdminNotifications() {
    const container = document.getElementById('adminNotificationsList');
    const token = localStorage.getItem('notaire_token');
    if (!container || !token) return;
    container.innerHTML = '<p class="admin-users-state">Cargando notificaciones...</p>';
    try {
        const response = await fetch(ADMIN_NOTIFICATIONS_URL, { headers: { Authorization: `Bearer ${token}` } });
        const result = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(result.detalle || result.error || 'No se pudieron cargar las notificaciones');
        adminNotifications = Array.isArray(result.items) ? result.items : [];
        renderAdminNotifications();
    } catch (error) {
        container.innerHTML = `<div class="admin-notification-empty"><i class="fas fa-triangle-exclamation"></i><strong>No se pudieron cargar</strong><span>${escapeNotification(error.message)}</span></div>`;
    }
}

document.addEventListener('DOMContentLoaded', () => {
    loadAdminNotifications();
    document.getElementById('btnRefreshNotifications')?.addEventListener('click', loadAdminNotifications);
    document.getElementById('adminNotificationFilter')?.addEventListener('change', renderAdminNotifications);
    document.getElementById('btnMarkNotificationsRead')?.addEventListener('click', () => {
        adminNotifications.forEach(item => adminReadNotificationIds.add(item.id));
        localStorage.setItem('notaire_admin_read_notifications', JSON.stringify([...adminReadNotificationIds]));
        renderAdminNotifications();
    });
    document.querySelector('#sidebarMenu a[data-target="view-notificaciones"]')?.addEventListener('click', loadAdminNotifications);
});
