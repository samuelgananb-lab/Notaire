/**
 * NOTAIRE - CLIENTE DASHBOARD EXTENDED ENGINE
 * Calendario, Metas, Configuración, Notificaciones del sistema
 */

/* ============================================================
   ESTADO DEL CALENDARIO
   ============================================================ */
const CalendarState = {
    currentDate: new Date(),
    viewMode: 'month', // 'month' | 'week' | 'day'
    events: [],
    currentEventId: null,
    upcomingExpanded: false
};

const typeColorMap = {
    purple: { bg: 'rgba(var(--color-primary-rgb), 0.4)', border: 'var(--color-primary)', dot: 'var(--color-primary)', label: 'Notarial' },
    green:  { bg: 'rgba(16, 185, 129, 0.3)',  border: '#10b981', dot: '#10b981', label: 'Financiero' },
    orange: { bg: 'rgba(var(--color-accent-orange-rgb), 0.18)', border: 'var(--color-accent-orange)', dot: 'var(--color-accent-orange)', label: 'Recordatorio' },
    blue:   { bg: 'rgba(6, 182, 212, 0.3)',   border: '#06b6d4', dot: '#06b6d4', label: 'Personal' },
    pink:   { bg: 'rgba(236, 72, 153, 0.3)',  border: '#ec4899', dot: '#ec4899', label: 'Cumpleaños' },
};

const MONTH_NAMES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
const DEFAULT_BUDGET_CATEGORY_ORDER = ['services', 'food', 'transport', 'savings', 'entertainment'];
const DEFAULT_BUDGET_CATEGORY_ORDER_VERSION = 2;

/* ============================================================
   INICIALIZACIÓN
   ============================================================ */
document.addEventListener('DOMContentLoaded', () => {
    initCalendar();
    void initConfigView();
    initEmojiPicker();
    initNotificationCenter();
    setupNavigateTo();
    scheduleNotificationChecks();
    cargarEventosPersistidos();
});

async function cargarEventosPersistidos() {
    const token = localStorage.getItem('notaire_token');
    if (!token) return;
    try {
        const response = await fetch('/api/eventos', { headers: { Authorization: `Bearer ${token}` } });
        if (!response.ok) throw new Error('Error al cargar eventos');
        const eventos = await response.json();
        CalendarState.events = eventos.map(normalizeCalendarEvent);
        renderCalendar();
        CalendarState.events.forEach(scheduleEventNotifications);
    } catch (error) {
        console.error('Error cargando eventos persistidos:', error);
    } finally {
        runScheduledDigests();
    }
}

function normalizeCalendarEvent(evento) {
    const tiposVisuales = { notarial: 'purple', financiero: 'green', recordatorio: 'orange', personal: 'blue', cumpleanos: 'pink' };
    const hora = evento.hora || String(evento.fecha_hora || '').slice(11, 16) || '08:00';
    return {
        ...evento,
        tipo: tiposVisuales[evento.tipo] || evento.tipo || 'purple',
        fecha: evento.fecha || String(evento.fecha_hora || '').slice(0, 10),
        hora: String(hora).slice(0, 5),
        notif24h: evento.notif24h !== false,
        notif1h: evento.notif1h !== false,
        notifOnDay: evento.notifOnDay === true || evento.notifonday === true
    };
}

/* ============================================================
   NAVEGACIÓN HELPER
   ============================================================ */
function setupNavigateTo() {
    if (typeof updateHeroGreeting === 'function') {
        updateHeroGreeting();
    } else if (typeof NotaireState !== 'undefined') {
        const firstName = NotaireState.user.nombre.split(' ')[0];
        const el = document.getElementById('heroUserName');
        if (el) el.textContent = firstName;
    }
}

/* ============================================================
   CALENDARIO
   ============================================================ */
function initCalendar() {
    document.getElementById('btnCalToday')?.addEventListener('click', () => {
        CalendarState.currentDate = new Date();
        renderCalendar();
    });
    document.getElementById('btnCalPrev')?.addEventListener('click', () => {
        const d = CalendarState.currentDate;
        CalendarState.currentDate = CalendarState.viewMode === 'month'
            ? new Date(d.getFullYear(), d.getMonth() - 1, 1)
            : new Date(d.getFullYear(), d.getMonth(), d.getDate() - (CalendarState.viewMode === 'week' ? 7 : 1));
        renderCalendar();
    });
    document.getElementById('btnCalNext')?.addEventListener('click', () => {
        const d = CalendarState.currentDate;
        CalendarState.currentDate = CalendarState.viewMode === 'month'
            ? new Date(d.getFullYear(), d.getMonth() + 1, 1)
            : new Date(d.getFullYear(), d.getMonth(), d.getDate() + (CalendarState.viewMode === 'week' ? 7 : 1));
        renderCalendar();
    });

    ['calViewMonth', 'calViewWeek', 'calViewDay'].forEach(id => {
        document.getElementById(id)?.addEventListener('click', function() {
            document.querySelectorAll('.view-toggle-btn').forEach(b => b.classList.remove('active'));
            this.classList.add('active');
            CalendarState.viewMode = id.replace('calView', '').toLowerCase();
            renderCalendar();
        });
    });

    const monthTitle = document.getElementById('calMonthTitle');
    const monthPicker = document.getElementById('calendarMonthPicker');
    monthTitle?.addEventListener('click', () => {
        if (typeof monthPicker?.showPicker === 'function') monthPicker.showPicker();
        else monthPicker?.click();
    });
    monthPicker?.addEventListener('change', () => {
        if (!monthPicker.value) return;
        const [year, month] = monthPicker.value.split('-').map(Number);
        CalendarState.currentDate = new Date(year, month - 1, 1);
        renderCalendar();
    });
    document.getElementById('btnUpcomingAll')?.addEventListener('click', event => {
        CalendarState.upcomingExpanded = !CalendarState.upcomingExpanded;
        event.currentTarget.setAttribute('aria-expanded', String(CalendarState.upcomingExpanded));
        renderUpcomingEvents();
    });

    renderCalendar();
}

function renderCalendar() {
    const d = CalendarState.currentDate;
    const year = d.getFullYear();
    const month = d.getMonth();
    const today = new Date();

    const titleEl = document.getElementById('calMonthTitle');
    const english = window.getCurrentLang?.() === 'en';
    const monthName = english
        ? new Intl.DateTimeFormat('en', { month: 'long' }).format(new Date(year, month, 1))
        : MONTH_NAMES[month];
    const title = `${monthName} ${year}`;
    if (titleEl) {
        titleEl.textContent = title;
        titleEl.setAttribute('aria-label', `${english ? 'Select month and year' : 'Seleccionar mes y año'}: ${title}`);
    }
    const monthPicker = document.getElementById('calendarMonthPicker');
    if (monthPicker) monthPicker.value = `${year}-${String(month + 1).padStart(2, '0')}`;

    renderCalendarGrid(year, month, today);
    renderUpcomingEvents();
    renderMonthSummary(year, month);
}

function renderCalendarGrid(year, month, today) {
    if (CalendarState.viewMode === 'month') {
        renderMonthGrid(year, month, today);
        return;
    }

    const grid = document.getElementById('calendarMonthGrid');
    if (!grid) return;
    const headers = Array.from(grid.querySelectorAll('.cal-day-header'));
    grid.classList.toggle('is-day-view', CalendarState.viewMode === 'day');
    grid.classList.toggle('is-week-view', CalendarState.viewMode === 'week');
    const start = new Date(CalendarState.currentDate);
    if (CalendarState.viewMode === 'week') start.setDate(start.getDate() - start.getDay());
    const days = CalendarState.viewMode === 'week' ? 7 : 1;
    const visibleHeaders = CalendarState.viewMode === 'day' ? [headers[start.getDay()]] : headers;
    grid.replaceChildren(...visibleHeaders.filter(Boolean).map(header => header.cloneNode(true)));
    for (let offset = 0; offset < days; offset += 1) {
        const date = new Date(start);
        date.setDate(start.getDate() + offset);
        grid.appendChild(createDayCell(date.getFullYear(), date.getMonth(), date.getDate(), false, today));
    }
}

function renderMonthGrid(year, month, today) {
    const grid = document.getElementById('calendarMonthGrid');
    if (!grid) return;
    grid.classList.remove('is-day-view', 'is-week-view');

    // Mantener encabezados
    const headers = Array.from(grid.querySelectorAll('.cal-day-header'));
    grid.innerHTML = '';
    headers.forEach(h => grid.appendChild(h.cloneNode(true)));

    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const daysInPrevMonth = new Date(year, month, 0).getDate();

    // Rellenar días del mes anterior
    for (let i = firstDay - 1; i >= 0; i--) {
        const day = daysInPrevMonth - i;
        grid.appendChild(createDayCell(year, month - 1, day, true, today));
    }

    // Días del mes actual
    for (let day = 1; day <= daysInMonth; day++) {
        grid.appendChild(createDayCell(year, month, day, false, today));
    }

    // Rellenar días del mes siguiente
    const totalCells = firstDay + daysInMonth;
    const remaining = (7 - (totalCells % 7)) % 7;
    for (let day = 1; day <= remaining; day++) {
        grid.appendChild(createDayCell(year, month + 1, day, true, today));
    }
}

function createDayCell(year, month, day, otherMonth, today) {
    const cell = document.createElement('div');
    cell.className = 'cal-day-cell' + (otherMonth ? ' other-month' : '');

    const cellDate = new Date(year, month, day);
    const dateStr = formatDateIso(cellDate);
    const isToday = !otherMonth && 
        today.getDate() === day && 
        today.getMonth() === month && 
        today.getFullYear() === year;

    if (isToday) cell.classList.add('active-day');

    const numDiv = document.createElement('div');
    numDiv.className = 'cal-day-num';
    if (isToday) {
        numDiv.innerHTML = `<span class="active-day-badge">${day}</span>`;
    } else {
        numDiv.textContent = day;
    }
    cell.appendChild(numDiv);

    const dayEvents = CalendarState.events.filter(e => e.fecha === dateStr);
    dayEvents.forEach(evt => {
        const colors = typeColorMap[evt.tipo] || typeColorMap.purple;
        const pill = document.createElement('div');
        pill.className = 'cal-event-pill';
        pill.dataset.userContent = 'true';
        pill.style.background = colors.bg;
        pill.style.border = `1px solid ${colors.border}`;
        pill.textContent = (evt.hora ? evt.hora + ' ' : '') + evt.titulo;
        pill.addEventListener('click', event => {
            event.stopPropagation();
            openDetalleEvento(evt.id);
        });
        cell.appendChild(pill);
    });

    cell.addEventListener('click', () => {
        const fechaInput = document.getElementById('eventoFecha');
        if (fechaInput) fechaInput.value = dateStr;
        openModalNuevoEvento();
    });

    return cell;
}

function formatDateIso(date) {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
}

function renderUpcomingEvents() {
    const container = document.getElementById('upcomingEventsList');
    if (!container) return;

    const today = new Date();
    const todayStr = formatDateIso(today);

    const upcoming = CalendarState.events
        .filter(e => e.fecha >= todayStr)
        .sort((a, b) => a.fecha.localeCompare(b.fecha) || String(a.hora || '').localeCompare(String(b.hora || '')));
    const english = window.getCurrentLang?.() === 'en';
    const button = document.getElementById('btnUpcomingAll');
    if (button) {
        button.disabled = upcoming.length <= 5;
        button.textContent = CalendarState.upcomingExpanded
            ? (english ? 'Show less' : 'Ver menos')
            : (english ? 'Show all' : 'Ver todos');
        button.setAttribute('aria-expanded', String(CalendarState.upcomingExpanded));
    }

    if (upcoming.length === 0) {
        container.innerHTML = `<div style="text-align:center; padding: 20px; color: var(--color-text-muted);">
            <i class="fas fa-calendar-check" style="font-size:28px; opacity:0.4; display:block; margin-bottom:8px;"></i>
            ${english ? 'No upcoming events' : 'Sin eventos próximos'}
        </div>`;
        return;
    }

    container.innerHTML = upcoming.slice(0, CalendarState.upcomingExpanded ? upcoming.length : 5).map(evt => {
        const colors = typeColorMap[evt.tipo] || typeColorMap.purple;
        const dateLabel = getDateLabel(evt.fecha);
        const iconMap = { purple: '⚖️', green: '💳', orange: '🔔', blue: '👤', pink: '🎂' };
        return `
            <div class="upcoming-event-card" style="cursor:pointer;" onclick="openDetalleEvento(${evt.id})">
                <div class="upcoming-event-left">
                    <div class="event-icon-box" style="background: ${colors.bg}; border: 1px solid ${colors.border};">
                        ${iconMap[evt.tipo] || '📅'}
                    </div>
                    <div class="event-details">
                        <span class="event-title" data-user-content="true">${escapeHtmlExt(evt.titulo)}</span>
                        <span class="event-subtext" data-user-content="true">${escapeHtmlExt(evt.nota || '')}</span>
                        <span class="event-subtext" style="color: ${colors.dot};">
                            <i class="fas fa-clock" style="font-size:10px;"></i> ${dateLabel}${evt.hora ? ', ' + evt.hora : ''}
                        </span>
                    </div>
                </div>
                <button class="icon-btn-action event-notification-toggle" type="button" aria-label="${evt.notif24h || evt.notif1h ? 'Desactivar notificaciones' : 'Activar notificaciones'}" title="${evt.notif24h || evt.notif1h ? 'Desactivar notificaciones' : 'Activar notificaciones'}" style="width:32px; height:32px;" onclick="toggleEventNotif(event, ${evt.id})">
                    <i class="fas fa-bell" style="font-size:12px; color: ${evt.notif24h ? '#10b981' : 'var(--color-text-dim)'};"></i>
                </button>
            </div>
        `;
    }).join('');
}

function getDateLabel(dateStr) {
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(today.getDate() + 1);
    const d = new Date(dateStr + 'T00:00:00');

    if (formatDateIso(d) === formatDateIso(today)) return 'Hoy';
    if (formatDateIso(d) === formatDateIso(tomorrow)) return 'Mañana';

    const months = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];
    return `${d.getDate()} ${months[d.getMonth()]}`;
}

function renderMonthSummary(year, month) {
    const container = document.getElementById('calMonthSummary');
    if (!container) return;

    const monthStr = `${year}-${String(month + 1).padStart(2, '0')}`;
    const monthEvents = CalendarState.events.filter(e => e.fecha.startsWith(monthStr));

    const counts = {
        total: monthEvents.length,
        pagos: monthEvents.filter(e => e.tipo === 'green').length,
        recordatorios: monthEvents.filter(e => e.tipo === 'orange').length,
        personal: monthEvents.filter(e => e.tipo === 'blue' || e.tipo === 'pink').length,
    };

    const items = [
        { icon: '📅', color: 'var(--color-primary)', val: counts.total, lbl: 'Eventos' },
        { icon: '💳', color: '#10b981', val: counts.pagos, lbl: 'Pagos' },
        { icon: '🔔', color: 'var(--color-accent-orange)', rgb: 'var(--color-accent-orange-rgb)', val: counts.recordatorios, lbl: 'Recordatorio' },
        { icon: '👤', color: '#06b6d4', val: counts.personal, lbl: 'Personal' },
    ];

    container.innerHTML = items.map(item => `
        <div class="summary-mini-card">
            <div class="mini-card-icon" style="background: rgba(${item.rgb || hexToRgb(item.color)}, 0.15); font-size: 20px;">${item.icon}</div>
            <div>
                <div class="mini-card-val" style="color: ${item.color};">${item.val}</div>
                <div class="mini-card-lbl">${item.lbl}</div>
            </div>
        </div>
    `).join('');
}

function hexToRgb(hex) {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? `${parseInt(result[1],16)}, ${parseInt(result[2],16)}, ${parseInt(result[3],16)}` : '140, 0, 255';
}

/* ============================================================
   MODAL NUEVO EVENTO
   ============================================================ */
function openModalNuevoEvento() {
    const form = document.getElementById('formNuevoEvento');
    if (form) form.reset();
    // Fecha por defecto: hoy
    const fechaInput = document.getElementById('eventoFecha');
    if (fechaInput && !fechaInput.value) {
        fechaInput.value = formatDateIso(new Date());
    }
    // Checkboxes por defecto
    document.getElementById('notifDiaBefore').checked = true;
    document.getElementById('notifHourBefore').checked = true;
    document.getElementById('notifOnDay').checked = false;

    openModal('modalNuevoEvento');
}

async function handleGuardarEvento(event) {
    event.preventDefault();
    const titulo = document.getElementById('eventoTitulo').value;
    const tipo = document.getElementById('eventoTipo').value;
    const fecha = document.getElementById('eventoFecha').value;
    const hora = document.getElementById('eventoHora').value;
    const nota = document.getElementById('eventoNota').value;
    const notif24h = document.getElementById('notifDiaBefore').checked;
    const notif1h = document.getElementById('notifHourBefore').checked;
    const notifOnDay = document.getElementById('notifOnDay').checked;

    const token = localStorage.getItem('notaire_token');
    try {
        const response = await fetch('/api/eventos', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
            body: JSON.stringify({ titulo, tipo, fecha, hora, nota, notif24h, notif1h, notifOnDay })
        });
        const result = await response.json();
        if (!response.ok) throw new Error(result.detalle || result.error || 'No se pudo guardar el evento');
        const newEvt = normalizeCalendarEvent(result.evento);
        CalendarState.events.push(newEvt);
        closeModal('modalNuevoEvento');
        renderCalendar();
        showToast(`✅ Evento "${titulo}" guardado.`);
        scheduleEventNotifications(newEvt);
    } catch (error) {
        showToast(error.message);
    }
}

/* ============================================================
   DETALLE DE EVENTO
   ============================================================ */
function openDetalleEvento(id) {
    const evt = CalendarState.events.find(e => e.id === id);
    if (!evt) return;
    CalendarState.currentEventId = id;

    const colors = typeColorMap[evt.tipo] || typeColorMap.purple;
    const dateLabel = getDateLabel(evt.fecha);

    document.getElementById('detalleEventoTitulo').textContent = evt.titulo;
    document.getElementById('detalleEventoBody').innerHTML = `
        <div style="display:flex; flex-direction:column; gap: 16px;">
            <div style="display:flex; align-items:center; gap: 12px; padding: 16px; background: ${colors.bg}; border: 1px solid ${colors.border}; border-radius: 14px;">
                <div style="font-size: 36px;">📅</div>
                <div>
                    <div data-user-content="true" style="font-size: 16px; font-weight:700; color:var(--color-text-main);">${escapeHtmlExt(evt.titulo)}</div>
                    <div style="font-size: 13px; color: ${colors.dot};">${colors.label} • ${dateLabel}${evt.hora ? ' a las ' + evt.hora : ''}</div>
                </div>
            </div>
            ${evt.nota ? `<div style="padding:14px; background: rgba(255,255,255,0.03); border-radius:12px; font-size:14px; color: var(--color-text-muted);">
                <i class="fas fa-sticky-note" style="margin-right:8px; color: var(--color-secondary-light);"></i><span data-user-content="true">${escapeHtmlExt(evt.nota)}</span>
            </div>` : ''}
            <div style="display:flex; gap:10px; flex-wrap:wrap;">
                ${evt.notif24h ? `<span class="metric-trend-badge trend-up"><i class="fas fa-bell"></i> 24h antes</span>` : ''}
                ${evt.notif1h ? `<span class="metric-trend-badge trend-up"><i class="fas fa-bell"></i> 1h antes</span>` : ''}
                ${!evt.notif24h && !evt.notif1h ? `<span class="metric-trend-badge trend-neutral"><i class="fas fa-bell-slash"></i> Sin recordatorios</span>` : ''}
            </div>
        </div>
    `;
    openModal('modalDetalleEvento');
}

async function deleteCurrentEvent() {
    const id = CalendarState.currentEventId;
    if (!id) return;
    const evt = CalendarState.events.find(e => e.id === id);
    try {
        const response = await fetch(`/api/eventos/${encodeURIComponent(id)}`, {
            method: 'DELETE',
            headers: { Authorization: `Bearer ${localStorage.getItem('notaire_token') || ''}` }
        });
        if (!response.ok) throw new Error('No se pudo eliminar el evento');
        CalendarState.events = CalendarState.events.filter(e => e.id !== id);
        closeModal('modalDetalleEvento');
        renderCalendar();
        showToast(`🗑️ Evento "${evt?.titulo || ''}" eliminado.`);
    } catch (error) {
        showToast(error.message);
    }
}

async function toggleEventNotif(e, id) {
    e.stopPropagation();
    const evt = CalendarState.events.find(ev => String(ev.id) === String(id));
    if (!evt) return;
    const enabled = !(evt.notif24h || evt.notif1h);
    try {
        const response = await fetch(`/api/eventos/${encodeURIComponent(id)}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${localStorage.getItem('notaire_token') || ''}` },
            body: JSON.stringify({ notif24h: enabled, notif1h: enabled })
        });
        const result = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(result.detalle || result.error || 'No se pudieron actualizar los recordatorios.');
        const updated = normalizeCalendarEvent(result.evento);
        Object.assign(evt, updated);
        scheduleEventNotifications(updated);
        renderCalendar();
        const english = window.getCurrentLang?.() === 'en';
        showToast(enabled
            ? (english ? 'Event reminders enabled.' : '🔔 Notificaciones activadas para el evento.')
            : (english ? 'Event reminders disabled.' : '🔕 Notificaciones desactivadas.'));
    } catch (error) {
        console.error('Error al guardar las notificaciones del evento:', error);
        showToast(error.message);
    }
}

/* ============================================================
   NOTIFICACIONES DEL SISTEMA
   ============================================================ */
const NOTIFICATION_STORE_BASE = 'notaire_notification_center';

function notificationStoreKey() {
    let account = 'guest';
    try {
        const user = JSON.parse(localStorage.getItem('notaire_user') || '{}');
        account = user.id || user.auth_id || user.email || account;
    } catch (error) {
        console.error('No se pudo identificar la cuenta para las notificaciones:', error);
    }
    return `${NOTIFICATION_STORE_BASE}:${String(account).toLowerCase()}`;
}

function readNotificationHistory() {
    try {
        const records = JSON.parse(localStorage.getItem(notificationStoreKey()) || '[]');
        return Array.isArray(records) ? records : [];
    } catch (error) {
        console.error('No se pudo cargar el centro de notificaciones:', error);
        return [];
    }
}

function saveNotificationHistory(records) {
    localStorage.setItem(notificationStoreKey(), JSON.stringify(records.slice(0, 100)));
}

function initNotificationCenter() {
    const center = document.getElementById('notificationCenter');
    const bell = document.getElementById('notificationBell');
    const panel = document.getElementById('notificationPanel');
    const list = document.getElementById('notificationList');
    const markRead = document.getElementById('markNotificationsRead');
    if (!center || !bell || !panel || !list) return;

    bell.addEventListener('click', () => {
        const isOpen = panel.hidden;
        panel.hidden = !isOpen;
        bell.setAttribute('aria-expanded', String(isOpen));
        if (isOpen) renderNotificationCenter();
    });
    markRead?.addEventListener('click', () => {
        saveNotificationHistory(readNotificationHistory().map(record => ({ ...record, read: true })));
        renderNotificationCenter();
    });
    list.addEventListener('click', event => {
        const item = event.target.closest('[data-notification-id]');
        if (!item) return;
        const records = readNotificationHistory();
        const record = records.find(entry => entry.id === item.dataset.notificationId);
        if (record) {
            record.read = true;
            saveNotificationHistory(records);
        }
        if (record?.target) navigateTo(record.target);
        panel.hidden = true;
        bell.setAttribute('aria-expanded', 'false');
        renderNotificationCenter();
    });
    document.addEventListener('click', event => {
        if (!center.contains(event.target) && !panel.hidden) {
            panel.hidden = true;
            bell.setAttribute('aria-expanded', 'false');
        }
    });
    document.addEventListener('keydown', event => {
        if (event.key === 'Escape' && !panel.hidden) {
            panel.hidden = true;
            bell.setAttribute('aria-expanded', 'false');
            bell.focus();
        }
    });
    document.addEventListener('notaire:languagechange', () => {
        renderNotificationCenter();
        updateBudgetPriorities();
    });
    renderNotificationCenter();
}

function renderNotificationCenter() {
    const list = document.getElementById('notificationList');
    const count = document.getElementById('notificationCount');
    const summary = document.getElementById('notificationSummary');
    if (!list) return;

    const records = readNotificationHistory();
    const unread = records.filter(record => !record.read).length;
    if (count) {
        count.hidden = unread === 0;
        count.textContent = unread > 99 ? '99+' : String(unread);
    }
    const english = window.getCurrentLang?.() === 'en';
    if (summary) summary.textContent = unread
        ? (english ? `${unread} unread` : `${unread} sin leer`)
        : (records.length ? (english ? 'All caught up' : 'Todo al día') : (english ? 'Your alerts will appear here' : 'Tus avisos aparecerán aquí'));
    list.replaceChildren();
    const dateFormatter = new Intl.DateTimeFormat(english ? 'en' : 'es-CO', {
        dateStyle: 'medium',
        timeStyle: 'short'
    });

    if (!records.length) {
        const empty = document.createElement('div');
        empty.className = 'notification-empty';
        const icon = document.createElement('i');
        icon.className = 'far fa-bell';
        const title = document.createElement('strong');
        title.textContent = english ? 'No notifications yet' : 'Sin notificaciones por ahora';
        const description = document.createElement('div');
        description.textContent = english
            ? 'Reminders and financial alerts will appear here.'
            : 'Los recordatorios y avisos financieros aparecerán aquí.';
        empty.append(icon, title, description);
        list.append(empty);
        return;
    }

    records.forEach(record => {
        const item = document.createElement('button');
        item.type = 'button';
        item.className = `notification-item${record.read ? '' : ' unread'}`;
        item.dataset.notificationId = record.id;
        item.setAttribute('role', 'listitem');
        const icon = document.createElement('span');
        icon.className = 'notification-item-icon';
        const iconElement = document.createElement('i');
        const notificationIcons = {
            calendar: 'fas fa-calendar-check',
            goal: 'fas fa-bullseye',
            budget: 'fas fa-wallet',
            daily: 'fas fa-sun',
            weekly: 'fas fa-chart-line',
            monthly: 'fas fa-calendar-days'
        };
        iconElement.className = notificationIcons[record.type] || 'fas fa-circle-info';
        icon.append(iconElement);
        const copy = document.createElement('span');
        copy.className = 'notification-item-copy';
        const title = document.createElement('strong');
        title.textContent = record.title;
        const body = document.createElement('span');
        body.textContent = record.body;
        const date = document.createElement('time');
        date.dateTime = record.createdAt;
        date.textContent = dateFormatter.format(new Date(record.createdAt));
        copy.append(title, body, date);
        item.append(icon, copy);
        list.append(item);
    });
}

async function requestBrowserNotifications() {
    if (!('Notification' in window)) {
        showToast('Este navegador no permite notificaciones del sistema.');
        return false;
    }
    if (Notification.permission === 'denied') {
        showToast('El navegador bloqueó las notificaciones. Habilítalas en sus permisos.');
        return false;
    }
    if (Notification.permission === 'granted') return true;
    try {
        const permission = await Notification.requestPermission();
        if (permission === 'granted') return true;
        showToast('El navegador bloqueó las notificaciones. Puedes habilitarlas en sus permisos.');
        return false;
    } catch (error) {
        console.error('No se pudo solicitar permiso para notificaciones:', error);
        showToast('No se pudo activar el permiso de notificaciones del navegador.');
        return false;
    }
}

function scheduleEventNotifications(evt) {
    if (!evt.fecha) return;
    const evtDateTime = new Date(`${evt.fecha}T${String(evt.hora || '08:00').slice(0, 5)}:00`);
    const cfg = notifCfg();
    const english = window.getCurrentLang?.() === 'en';

    if (evt.notif24h && cfg.h24) {
        const notif24 = new Date(evtDateTime.getTime() - 24 * 60 * 60 * 1000);
        scheduleNotification(notif24, `${english ? '📅 Tomorrow reminder' : '📅 Recordatorio mañana'}: ${evt.titulo}`, evt.nota || '', {
            type: 'calendar', target: 'view-recordatorios', preference: 'h24', dedupeKey: `event:${evt.id}:${evt.fecha}:24h`
        });
    }
    if (evt.notif1h && cfg.h1) {
        const notif1 = new Date(evtDateTime.getTime() - 60 * 60 * 1000);
        scheduleNotification(notif1, `${english ? '⏰ In 1 hour' : '⏰ En 1 hora'}: ${evt.titulo}`, evt.nota || '', {
            type: 'calendar', target: 'view-recordatorios', preference: 'h1', dedupeKey: `event:${evt.id}:${evt.fecha}:1h`
        });
    }
    if (evt.notifOnDay) {
        scheduleNotification(evtDateTime, `${english ? '🔔 Now' : '🔔 Ahora'}: ${evt.titulo}`, evt.nota || '', {
            type: 'calendar', target: 'view-recordatorios', dedupeKey: `event:${evt.id}:${evt.fecha}:now`
        });
    }
}

function scheduleNotification(triggerTime, title, body, options = {}) {
    const now = new Date();
    const delay = triggerTime.getTime() - now.getTime();
    if (delay <= 0) return;

    if (delay < 48 * 60 * 60 * 1000) { // Solo si es en menos de 48h
        setTimeout(() => {
            if (options.preference && !notifCfg()[options.preference]) return;
            triggerSystemNotif(title, body, options);
        }, delay);
    }
}

function triggerSystemNotif(title, body, options = {}) {
    const now = new Date();
    const dedupeKey = options.dedupeKey || `${title}:${now.toISOString().slice(0, 16)}`;
    const records = readNotificationHistory();
    if (records.some(record => record.dedupeKey === dedupeKey)) return;
    records.unshift({
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        dedupeKey,
        title,
        body,
        type: options.type || 'general',
        target: options.target || '',
        createdAt: now.toISOString(),
        read: false
    });
    saveNotificationHistory(records);
    renderNotificationCenter();

    // Notificación del navegador
    if (notifCfg().browser && 'Notification' in window && Notification.permission === 'granted') {
        new Notification(title, {
            body: body,
            icon: '/favicon.svg',
            badge: '/favicon.svg'
        });
    }

    // Banner interno
    showSystemBanner(title, body);
}

function showSystemBanner(title, body) {
    const banner = document.getElementById('systemNotifBanner');
    const titleEl = document.getElementById('systemNotifTitle');
    const subEl = document.getElementById('systemNotifSub');
    if (!banner) return;

    if (titleEl) titleEl.textContent = title;
    if (subEl) subEl.textContent = body;
    banner.style.display = 'flex';

    setTimeout(() => {
        if (banner) banner.style.display = 'none';
    }, 8000);
}

function runScheduledDigests() {
    const now = new Date();
    const dateKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    const cfg = notifCfg();
    const english = window.getCurrentLang?.() === 'en';
    if (now.getHours() >= 9 && cfg.daily) {
        const dueToday = CalendarState.events.filter(event => event.fecha === dateKey);
        const body = dueToday.length
            ? (english ? `You have ${dueToday.length} calendar commitment${dueToday.length === 1 ? '' : 's'} today.` : `Tienes ${dueToday.length} compromiso${dueToday.length === 1 ? '' : 's'} en tu calendario para hoy.`)
            : (english ? 'Review your calendar and organize today’s financial commitments.' : 'Revisa tu calendario y organiza tus compromisos financieros del día.');
        triggerSystemNotif(english ? '☀️ Daily financial summary' : '☀️ Resumen financiero diario', body, {
            type: 'daily',
            target: 'view-recordatorios',
            dedupeKey: `daily:${dateKey}`
        });
    }
    if (now.getDate() === 1 && now.getHours() >= 9 && cfg.monthly) {
        triggerSystemNotif(
            english ? '📊 New month, new goals' : '📊 Nuevo mes, nuevas metas',
            english ? 'Review your monthly budget and adjust your savings priorities.' : 'Revisa tu presupuesto mensual y ajusta tus prioridades de ahorro.',
            {
            type: 'monthly',
            target: 'view-inicio',
            dedupeKey: `monthly:${dateKey.slice(0, 7)}`
            }
        );
    }
    if (now.getDay() === 1 && now.getHours() >= 9 && cfg.semanal) {
        triggerSystemNotif(
            english ? '🗓️ Weekly financial summary' : '🗓️ Resumen financiero semanal',
            english ? 'Take a few minutes to review your expenses, commitments and savings progress.' : 'Tómate unos minutos para revisar tus gastos, compromisos y avance de ahorro.',
            {
            type: 'weekly',
            target: 'view-inicio',
            dedupeKey: `weekly:${dateKey}`
            }
        );
    }
}

function scheduleNotificationChecks() {
    window.setInterval(() => {
        const now = new Date();
        const english = window.getCurrentLang?.() === 'en';
        CalendarState.events.forEach(evt => {
            if (!evt.fecha || !evt.hora) return;
            const evtTime = new Date(`${evt.fecha}T${String(evt.hora).slice(0, 5)}:00`);
            const diffMin = (evtTime - now) / 60000;
            const eventKey = `${evt.id}:${evt.fecha}`;

            if (evt.notif24h && notifCfg().h24 && diffMin > 1438 && diffMin < 1442) {
                triggerSystemNotif(`${english ? '📅 Tomorrow reminder' : '📅 Recordatorio mañana'}: ${evt.titulo}`, evt.nota || '', {
                    type: 'calendar', target: 'view-recordatorios', dedupeKey: `event:${eventKey}:24h`
                });
            }
            if (evt.notif1h && notifCfg().h1 && diffMin > 58 && diffMin < 62) {
                triggerSystemNotif(`${english ? '⏰ In 1 hour' : '⏰ En 1 hora'}: ${evt.titulo}`, evt.nota || '', {
                    type: 'calendar', target: 'view-recordatorios', dedupeKey: `event:${eventKey}:1h`
                });
            }
            if (evt.notifOnDay && diffMin > -1 && diffMin < 1) {
                triggerSystemNotif(`${english ? '🔔 Now' : '🔔 Ahora'}: ${evt.titulo}`, evt.nota || '', {
                    type: 'calendar', target: 'view-recordatorios', dedupeKey: `event:${eventKey}:now`
                });
            }
        });
        runScheduledDigests();
    }, 60000);
}

function openNotifSettings() {
    navigateTo('view-configuracion');
    setTimeout(() => {
        const notifCard = document.getElementById('notificationSettingsCard');
        if (notifCard) notifCard.scrollIntoView({ behavior: 'smooth' });
    }, 400);
}

/* ============================================================
   EMOJI PICKER – Modal nueva meta
   ============================================================ */
function initEmojiPicker() {
    const picker = document.getElementById('emojiPickerMeta');
    if (!picker) return;
    picker.addEventListener('click', (e) => {
        const opt = e.target.closest('.emoji-opt');
        if (!opt) return;
        picker.querySelectorAll('.emoji-opt').forEach(o => {
            o.classList.remove('selected');
            o.setAttribute('aria-pressed', 'false');
        });
        opt.classList.add('selected');
        opt.setAttribute('aria-pressed', 'true');
        const iconInput = document.getElementById('metaIcono');
        if (iconInput) iconInput.value = opt.dataset.emoji;
    });
}

/* ============================================================
   CONFIGURACIÓN
   ============================================================ */
async function initConfigView() {
    refreshConfigDisplay();
    initThemePalette();
    await cargarPreferenciasNotificacion();
    initBudgetPriorities();
}

function refreshConfigDisplay() {
    if (typeof NotaireState === 'undefined') return;
    const configNombre = document.getElementById('configNombre');
    const configEmail = document.getElementById('configEmail');
    const configTelefono = document.getElementById('configTelefono');
    const configAvatar = document.getElementById('configAvatarLarge');
    if (configNombre) configNombre.textContent = NotaireState.user.nombre;
    if (configEmail) configEmail.textContent = NotaireState.user.email || (window.translateText?.('Sin correo') || 'Sin correo');
    if (configTelefono) configTelefono.textContent = NotaireState.user.telefono || (window.translateText?.('Sin teléfono') || 'Sin teléfono');
    if (configAvatar) configAvatar.textContent = NotaireState.user.iniciales || 'SG';
}

function setThemeSwatch(themeName) {
    const allowedThemes = ['purple', 'blue', 'emerald', 'gold', 'rose', 'gray', 'black'];
    if (!allowedThemes.includes(themeName)) return;

    document.documentElement.setAttribute('data-color-palette', themeName);
    localStorage.setItem('notaire_color_palette', themeName);
    document.querySelectorAll('.theme-swatch').forEach(swatch => {
        const selected = swatch.dataset.theme === themeName;
        swatch.classList.toggle('active', selected);
        swatch.setAttribute('aria-pressed', String(selected));
    });
    document.dispatchEvent(new Event('notaire:palettechange'));
}

function initThemePalette() {
    const savedTheme = localStorage.getItem('notaire_color_palette');
    const theme = ['purple', 'blue', 'emerald', 'gold', 'rose', 'gray', 'black'].includes(savedTheme) ? savedTheme : 'purple';
    setThemeSwatch(theme);
    const storedMode = localStorage.getItem('notaire_theme');
    const savedMode = ['dark', 'light', 'auto'].includes(storedMode) ? storedMode : 'dark';
    const effectiveMode = savedMode === 'auto'
        ? (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
        : savedMode;
    document.documentElement.setAttribute('data-theme', effectiveMode);
    document.querySelectorAll('.config-toggle-opt').forEach(option => {
        option.classList.toggle('active', option.id === `themeOpt${savedMode[0].toUpperCase()}${savedMode.slice(1)}`);
    });

    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', event => {
        if (localStorage.getItem('notaire_theme') === 'auto') {
            document.documentElement.setAttribute('data-theme', event.matches ? 'dark' : 'light');
            document.dispatchEvent(new Event('notaire:palettechange'));
        }
    });
}

function setDisplayMode(mode, el) {
    if (!['dark', 'light', 'auto'].includes(mode)) return;
    localStorage.setItem('notaire_theme', mode);
    const effectiveMode = mode === 'auto'
        ? (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
        : mode;
    document.documentElement.setAttribute('data-theme', effectiveMode);
    document.querySelectorAll('.config-toggle-opt').forEach(option => {
        const selected = option === el || option.id === `themeOpt${mode[0].toUpperCase()}${mode.slice(1)}`;
        option.classList.toggle('active', selected);
    });
    const themeToggle = document.getElementById('themeToggleBtn');
    const icon = themeToggle?.querySelector('i');
    if (icon) icon.className = effectiveMode === 'dark' ? 'fas fa-sun' : 'fas fa-moon';
    document.dispatchEvent(new Event('notaire:palettechange'));
}

async function toggleNotifBrowser(input) {
    if (input.checked) {
        input.checked = await requestBrowserNotifications();
        if (input.checked) showToast('🔔 Notificaciones del navegador activadas.');
    } else {
        showToast('🔕 Notificaciones del navegador desactivadas.');
    }
    saveNotifConfig();
}

function notifCfg() {
    const defaults = { browser: true, email: true, h24: true, h1: true, gastos: true, semanal: false, daily: true, monthly: true };
    try {
        return { ...defaults, ...JSON.parse(localStorage.getItem('notaire_notif_cfg') || '{}') };
    } catch {
        return defaults;
    }
}

function authHeadersExt() {
    return { 'Content-Type': 'application/json', Authorization: 'Bearer ' + localStorage.getItem('notaire_token') };
}

function applyNotifConfigToUI(cfg, presupuesto) {
    const set = (id, value) => { const el = document.getElementById(id); if (el) el.checked = Boolean(value); };
    set('togNotifBrowser', cfg.browser);
    set('togNotifEmail', cfg.email);
    set('togNotif24h', cfg.h24);
    set('togNotif1h', cfg.h1);
    set('togNotifGastos', cfg.gastos);
    set('togNotifSemanal', cfg.semanal);
    set('togNotifDaily', cfg.daily);
    set('togNotifMonthly', cfg.monthly);
    const budgetInput = document.getElementById('cfgPresupuesto');
    if (budgetInput && presupuesto > 0) {
        budgetInput.value = presupuesto;
        window.formatAmountInput?.(budgetInput);
    }
}

async function cargarPreferenciasNotificacion() {
    applyNotifConfigToUI(notifCfg(), Number(localStorage.getItem('notaire_presupuesto') || 0));
    if (!localStorage.getItem('notaire_token')) return;
    try {
        const response = await fetch('/api/auth/preferencias', { headers: authHeadersExt() });
        if (!response.ok) {
            console.warn(`No se pudieron sincronizar las preferencias de notificación (HTTP ${response.status}).`);
            return;
        }
        const {
            presupuesto,
            presupuesto_categorias: remoteCategories,
            presupuesto_categorias_version: remoteCategoriesVersion = DEFAULT_BUDGET_CATEGORY_ORDER_VERSION,
            ...remoteCfg
        } = await response.json();
        const cfg = { ...notifCfg(), ...remoteCfg };
        localStorage.setItem('notaire_notif_cfg', JSON.stringify(cfg));
        const user = JSON.parse(localStorage.getItem('notaire_user') || '{}');
        const accountId = String(user.id || user.auth_id || user.email || '').trim().toLowerCase();
        const previousAccountId = localStorage.getItem('notaire_budget_account_id');
        const accountChanged = Boolean(previousAccountId && accountId && previousAccountId !== accountId);
        if (accountChanged && !Array.isArray(remoteCategories)) {
            localStorage.removeItem('notaire_presupuesto');
            localStorage.removeItem('notaire_presupuesto_categorias');
            localStorage.removeItem('notaire_presupuesto_categorias_version');
        }
        const localBudget = accountChanged ? 0 : Number(localStorage.getItem('notaire_presupuesto') || 0);
        const budget = presupuesto > 0 ? presupuesto : localBudget;
        if (budget > 0) localStorage.setItem('notaire_presupuesto', String(budget));
        if (Array.isArray(remoteCategories)) {
            localStorage.setItem('notaire_presupuesto_categorias', JSON.stringify(remoteCategories));
        }
        localStorage.setItem('notaire_presupuesto_categorias_version', String(remoteCategoriesVersion));
        if (accountId) localStorage.setItem('notaire_budget_account_id', accountId);
        applyNotifConfigToUI(cfg, budget);
        if (!Array.isArray(remoteCategories)) {
            const legacyCategories = JSON.parse(localStorage.getItem('notaire_presupuesto_categorias') || '[]');
            if (legacyCategories.length || (presupuesto <= 0 && localBudget > 0)) {
                await persistirPreferencias({
                    presupuesto: budget,
                    presupuesto_categorias: legacyCategories.length ? legacyCategories : null
                });
            }
        }
        evaluarAlertaPresupuesto();
    } catch (error) {
        console.error('No se pudieron cargar las preferencias de notificación:', error);
    }
}

async function persistirPreferencias(extra = {}) {
    if (!localStorage.getItem('notaire_token')) return false;
    try {
        const response = await fetch('/api/auth/preferencias', {
            method: 'PUT',
            headers: authHeadersExt(),
            body: JSON.stringify({
                ...notifCfg(),
                presupuesto: Number(localStorage.getItem('notaire_presupuesto') || 0),
                ...extra
            })
        });
        if (!response.ok) throw new Error(`El servidor respondió HTTP ${response.status}`);
        return true;
    } catch (error) {
        console.error('No se pudieron guardar las preferencias de notificación:', error);
        const english = window.getCurrentLang?.() === 'en';
        showToast(english
            ? 'Preferences are saved on this device but could not be synced to your account.'
            : 'Las preferencias quedaron guardadas en este dispositivo, pero no se sincronizaron con tu cuenta.');
        return false;
    }
}

function saveNotifConfig() {
    const cfg = {
        browser: document.getElementById('togNotifBrowser')?.checked,
        email: document.getElementById('togNotifEmail')?.checked,
        h24: document.getElementById('togNotif24h')?.checked,
        h1: document.getElementById('togNotif1h')?.checked,
        gastos: document.getElementById('togNotifGastos')?.checked,
        semanal: document.getElementById('togNotifSemanal')?.checked,
        daily: document.getElementById('togNotifDaily')?.checked,
        monthly: document.getElementById('togNotifMonthly')?.checked,
    };
    localStorage.setItem('notaire_notif_cfg', JSON.stringify(cfg));
    return persistirPreferencias();
}

function saveRegionConfig() {
    const idioma = document.getElementById('cfgIdioma')?.value;
    const moneda = document.getElementById('cfgMoneda')?.value;
    localStorage.setItem('notaire_region', JSON.stringify({ idioma, moneda }));
    showToast(`✅ Preferencias de región guardadas.`);
}

async function saveBudgetConfig() {
    const total = parseFormattedAmount(document.getElementById('cfgPresupuesto')?.value);
    if (!Number.isFinite(total) || total < 0) {
        showToast('⚠️ Ingresa un presupuesto mensual válido.');
        return;
    }
    const rows = [...document.querySelectorAll('.budget-cat-row')];
    const categories = rows.map((row, index) => ({
        id: row.dataset.budgetCategory,
        name: row.querySelector('.budget-cat-name')?.value.trim() || '',
        emoji: row.querySelector('.budget-cat-icon')?.dataset.emoji || '🏷️',
        value: parseFormattedAmount(row.querySelector('.budget-cat-input')?.value || ''),
        priority: Number(row.querySelector('.budget-cat-priority')?.value || index + 1)
    }));
    if (categories.some(category => !category.name || !Number.isFinite(category.value) || category.value < 0)) {
        showToast('⚠️ Cada categoría necesita un nombre y un monto válido.');
        return;
    }
    const names = categories.map(category => category.name.toLocaleLowerCase());
    if (new Set(names).size !== names.length) {
        showToast('⚠️ Cada categoría debe tener un nombre diferente.');
        return;
    }
    localStorage.setItem('notaire_presupuesto', String(Math.round(total)));
    localStorage.setItem('notaire_presupuesto_categorias', JSON.stringify(categories));
    localStorage.setItem('notaire_presupuesto_categorias_version', String(DEFAULT_BUDGET_CATEGORY_ORDER_VERSION));
    localStorage.removeItem('notaire_budget_alert');
    updateBudgetPriorities();
    if (!await persistirPreferencias({
        presupuesto_categorias: categories,
        presupuesto_categorias_version: DEFAULT_BUDGET_CATEGORY_ORDER_VERSION
    })) return;
    if (typeof cargarDatosFinancieros === 'function') cargarDatosFinancieros();
    showToast(`✅ Presupuesto mensual actualizado: $${Math.round(total).toLocaleString('es-CO')}`);
}

// Alerta en pantalla al llegar al 80% o superar el 100% del presupuesto (una vez por nivel y mes).
function evaluarAlertaPresupuesto() {
    const cfg = notifCfg();
    const presupuesto = Number(localStorage.getItem('notaire_presupuesto') || 0);
    if (!cfg.gastos || presupuesto <= 0) return;
    const gastado = Number(String(document.getElementById('valGastadoEsteMes')?.textContent || '').replace(/\D/g, ''));
    if (!gastado) return;
    const pct = (gastado / presupuesto) * 100;
    const nivel = pct >= 100 ? 100 : pct >= 80 ? 80 : 0;
    if (!nivel) return;
    const currentDate = new Date();
    const key = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}:${nivel}`;
    if (localStorage.getItem('notaire_budget_alert') === key) return;
    localStorage.setItem('notaire_budget_alert', key);
    const english = window.getCurrentLang?.() === 'en';
    triggerSystemNotif(
        nivel === 100
            ? (english ? '🚨 You exceeded your monthly budget' : '🚨 Superaste tu presupuesto mensual')
            : (english ? '⚠️ You are nearing your budget' : '⚠️ Estás cerca de tu presupuesto'),
        english
            ? `You have used ${Math.round(pct)}% of this month’s budget.`
            : `Has usado el ${Math.round(pct)}% de tu presupuesto de este mes.`,
        { type: 'budget', target: 'view-inicio', dedupeKey: `budget:${key}` }
    );
}

function initBudgetPriorities() {
    let savedCategories = [];
    const savedCategoriesRaw = localStorage.getItem('notaire_presupuesto_categorias');
    let hasSavedCategories = savedCategoriesRaw !== null;
    try {
        savedCategories = JSON.parse(savedCategoriesRaw || '[]');
        if (!Array.isArray(savedCategories)) savedCategories = [];
    } catch (error) {
        hasSavedCategories = false;
        console.error('No se pudieron cargar las categorías del presupuesto:', error);
    }
    let orderVersion = Number(localStorage.getItem('notaire_presupuesto_categorias_version') || 0);
    if (hasSavedCategories && orderVersion < DEFAULT_BUDGET_CATEGORY_ORDER_VERSION) {
        const byId = new Map(savedCategories.filter(item => item && item.id).map(item => [item.id, item]));
        const orderedDefaults = DEFAULT_BUDGET_CATEGORY_ORDER
            .map(id => byId.get(id))
            .filter(Boolean);
        const defaultIds = new Set(DEFAULT_BUDGET_CATEGORY_ORDER);
        const customAndOther = savedCategories.filter(item => item && !defaultIds.has(item.id));
        savedCategories = [...orderedDefaults, ...customAndOther]
            .map((category, index) => ({ ...category, priority: index + 1 }));
        localStorage.setItem('notaire_presupuesto_categorias', JSON.stringify(savedCategories));
        localStorage.setItem('notaire_presupuesto_categorias_version', String(DEFAULT_BUDGET_CATEGORY_ORDER_VERSION));
        orderVersion = DEFAULT_BUDGET_CATEGORY_ORDER_VERSION;
        void persistirPreferencias({
            presupuesto_categorias: savedCategories,
            presupuesto_categorias_version: orderVersion
        });
    }
    const savedById = new Map(savedCategories.filter(item => item && item.id).map(item => [item.id, item]));
    const savedByName = new Map(savedCategories.filter(item => item && item.name).map(item => [item.name, item]));
    document.querySelectorAll('#budgetCategoriesList .budget-cat-row').forEach(row => {
        const categoryName = row.querySelector('.budget-cat-name');
        const saved = savedById.get(row.dataset.budgetCategory) || savedByName.get(categoryName?.value.trim());
        if (hasSavedCategories && !saved && row.dataset.budgetCategory !== 'savings') row.remove();
    });
    savedCategories.filter(item => item && /^custom-[a-z0-9-]+$/i.test(item.id || '') && item.name)
        .forEach(item => document.getElementById('budgetCategoriesList')?.append(createBudgetCategoryRow(item)));
    const list = document.getElementById('budgetCategoriesList');
    document.querySelectorAll('.budget-cat-row').forEach(row => {
        const input = row.querySelector('.budget-cat-input');
        const categoryName = row.querySelector('.budget-cat-name');
        const saved = savedById.get(row.dataset.budgetCategory) || savedByName.get(categoryName?.value.trim());
        if (saved && categoryName && typeof saved.name === 'string') categoryName.value = saved.name;
        if (input && Number.isFinite(saved?.value)) {
            input.value = String(saved.value);
            window.formatAmountInput?.(input);
        }
        const priority = row.querySelector('.budget-cat-priority');
        if (priority && Number.isInteger(Number(saved?.priority))) priority.value = String(saved.priority);
        const emojiButton = row.querySelector('.budget-cat-icon');
        if (emojiButton) {
            const emoji = saved?.emoji || emojiButton.dataset.emoji || '🏷️';
            emojiButton.dataset.emoji = emoji;
            emojiButton.textContent = emoji;
            emojiButton.setAttribute('aria-label', `${window.getCurrentLang?.() === 'en' ? 'Choose emoji for' : 'Elegir emoji para'} ${categoryName?.value || ''}`);
            initializeBudgetCategoryRow(row, Boolean(row.querySelector('.budget-cat-edit')));
        }
    });
    translateBudgetCategoryNames();
    let categoryTotalBaseline = getBudgetCategoriesTotal(list);
    const syncBudgetTotalFromCategories = () => {
        const categoryTotal = getBudgetCategoriesTotal(list);
        const budgetInput = document.getElementById('cfgPresupuesto');
        const currentBudget = parseFormattedAmount(budgetInput?.value || '');
        if (budgetInput && Number.isFinite(currentBudget)) {
            const adjustedBudget = calculateBudgetTotalAfterCategoryChange(currentBudget, categoryTotal, categoryTotalBaseline);
            if (adjustedBudget !== currentBudget) {
                budgetInput.value = String(adjustedBudget);
                window.formatAmountInput?.(budgetInput);
            }
        }
        categoryTotalBaseline = categoryTotal;
    };
    document.addEventListener('notaire:languagechange', () => {
        translateBudgetCategoryNames();
        updateBudgetPriorities();
    });
    list?.addEventListener('input', event => {
        if (event.target.matches('.budget-cat-input')) syncBudgetTotalFromCategories();
        updateBudgetPriorities();
    });
    list?.addEventListener('change', event => {
        if (event.target.matches('.budget-cat-priority')) {
            updateBudgetPriorities(true, event.target.closest('.budget-cat-row'));
        }
    });
    list?.addEventListener('click', event => {
        const emojiOption = event.target.closest('.budget-cat-emoji-option');
        if (emojiOption) {
            const row = emojiOption.closest('.budget-cat-row');
            const emojiButton = row?.querySelector('.budget-cat-icon');
            if (emojiButton) {
                emojiButton.dataset.emoji = emojiOption.dataset.emoji;
                emojiButton.textContent = emojiOption.dataset.emoji;
                const picker = row.querySelector('.budget-cat-emoji-picker');
                if (picker) picker.hidden = true;
                row.classList.remove('has-open-emoji-picker');
            }
            return;
        }
        const emojiButton = event.target.closest('.budget-cat-icon');
        if (emojiButton) {
            const row = emojiButton.closest('.budget-cat-row');
            const picker = row?.querySelector('.budget-cat-emoji-picker');
            if (picker) {
                const isOpening = picker.hidden;
                list.querySelectorAll('.budget-cat-emoji-picker').forEach(openPicker => {
                    openPicker.hidden = true;
                    openPicker.closest('.budget-cat-row')?.classList.remove('has-open-emoji-picker');
                });
                picker.hidden = !isOpening;
                row.classList.toggle('has-open-emoji-picker', isOpening);
            }
            return;
        }
        const editButton = event.target.closest('.budget-cat-edit');
        if (editButton) {
            const row = editButton.closest('.budget-cat-row');
            const isEditing = row?.classList.toggle('is-editing');
            const nameInput = row?.querySelector('.budget-cat-name');
            const amountInput = row?.querySelector('.budget-cat-input');
            if (nameInput) nameInput.readOnly = !isEditing;
            if (amountInput) amountInput.readOnly = !isEditing;
            const english = window.getCurrentLang?.() === 'en';
            editButton.innerHTML = isEditing
                ? `<i class="fas fa-check" aria-hidden="true"></i><span>${english ? 'Done' : 'Listo'}</span>`
                : `<i class="fas fa-pen" aria-hidden="true"></i><span>${english ? 'Edit' : 'Editar'}</span>`;
            const editLabel = isEditing
                ? (english ? 'Finish editing category' : 'Terminar edición de categoría')
                : (english ? `Edit category ${nameInput?.value || ''}` : `Editar categoría ${nameInput?.value || ''}`);
            editButton.setAttribute('aria-label', editLabel);
            editButton.title = editLabel;
            if (isEditing) nameInput?.focus();
            return;
        }
        const removeButton = event.target.closest('.budget-cat-remove');
        if (!removeButton) return;
        removeButton.closest('.budget-cat-row')?.remove();
        syncBudgetTotalFromCategories();
        updateBudgetPriorities(true);
    });
    document.getElementById('budgetCategoryAdd')?.addEventListener('click', () => {
        const category = {
            id: `custom-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
            name: '',
            value: 0,
            priority: (list?.querySelectorAll('.budget-cat-row').length || 0) + 1
        };
        const row = createBudgetCategoryRow(category);
        list?.append(row);
        updateBudgetPriorities(true);
        row.querySelector('.budget-cat-name')?.focus();
    });
    document.getElementById('cfgPresupuesto')?.addEventListener('input', () => updateBudgetPriorities());
    updateBudgetPriorities(true);
}

function getBudgetCategoriesTotal(list) {
    if (!list) return 0;
    return [...list.querySelectorAll('.budget-cat-input')]
        .reduce((total, input) => total + parseFormattedAmount(input.value || ''), 0);
}

function calculateBudgetTotalAfterCategoryChange(currentBudget, categoryTotal, previousCategoryTotal) {
    return Math.max(0, currentBudget + categoryTotal - previousCategoryTotal);
}

function createBudgetCategoryRow(category) {
    const english = window.getCurrentLang?.() === 'en';
    const row = document.createElement('div');
    row.className = 'budget-cat-row';
    row.dataset.budgetCategory = category.id;
    row.innerHTML = `
        <button type="button" class="budget-cat-icon" data-emoji="🏷️" aria-label="${english ? 'Choose category emoji' : 'Elegir emoji de categoría'}" title="${english ? 'Choose emoji' : 'Elegir emoji'}">🏷️</button>
        <input type="text" class="budget-cat-name" aria-label="${english ? 'Category name' : 'Nombre de categoría'}" maxlength="40">
        <select class="budget-cat-priority" aria-label="${english ? 'Category priority' : 'Prioridad de categoría'}"></select>
        <input type="text" inputmode="decimal" data-format-number autocomplete="off" class="budget-cat-input" placeholder="$" aria-label="${english ? 'Category budget' : 'Presupuesto de categoría'}">
        <button type="button" class="budget-cat-edit" aria-label="${english ? 'Edit category' : 'Editar categoría'}"><i class="fas fa-check" aria-hidden="true"></i><span>${english ? 'Done' : 'Listo'}</span></button>
        <div class="budget-cat-emoji-picker" hidden></div>
        <button type="button" class="budget-cat-remove" aria-label="${english ? 'Delete category' : 'Eliminar categoría'}" title="${english ? 'Delete category' : 'Eliminar categoría'}"><i class="fas fa-trash-can" aria-hidden="true"></i></button>`;
    const emojiButton = row.querySelector('.budget-cat-icon');
    emojiButton.dataset.emoji = category.emoji || '🏷️';
    emojiButton.textContent = category.emoji || '🏷️';
    row.querySelector('.budget-cat-name').value = category.name;
    row.querySelector('.budget-cat-input').value = String(category.value || 0);
    window.formatAmountInput?.(row.querySelector('.budget-cat-input'));
    row.classList.add('is-editing');
    populateBudgetEmojiPicker(row);
    return row;
}

function initializeBudgetCategoryRow(row, readOnly = true) {
    const nameInput = row.querySelector('.budget-cat-name');
    const amountInput = row.querySelector('.budget-cat-input');
    if (nameInput) nameInput.readOnly = readOnly;
    if (amountInput) amountInput.readOnly = readOnly;
    const editButton = row.querySelector('.budget-cat-edit');
    if (editButton) {
        const english = window.getCurrentLang?.() === 'en';
        editButton.innerHTML = readOnly
            ? `<i class="fas fa-pen" aria-hidden="true"></i><span>${english ? 'Edit' : 'Editar'}</span>`
            : `<i class="fas fa-check" aria-hidden="true"></i><span>${english ? 'Done' : 'Listo'}</span>`;
    }
    populateBudgetEmojiPicker(row);
}

function populateBudgetEmojiPicker(row) {
    const picker = row.querySelector('.budget-cat-emoji-picker');
    if (!picker || picker.childElementCount) return;
    const sourceOptions = document.querySelectorAll('#emojiPickerMeta .emoji-opt');
    sourceOptions.forEach(source => {
        const option = document.createElement('button');
        option.type = 'button';
        option.className = 'budget-cat-emoji-option';
        option.dataset.emoji = source.dataset.emoji;
        option.textContent = source.dataset.emoji;
        const label = source.getAttribute('aria-label') || source.dataset.emoji;
        option.setAttribute('aria-label', window.translateText?.(label) || label);
        picker.append(option);
    });
}

function translateBudgetCategoryNames() {
    const english = window.getCurrentLang?.() === 'en';
    const localizedNames = {
        services: ['Servicios', 'Services'],
        food: ['Alimentación', 'Food'],
        transport: ['Transporte', 'Transport'],
        savings: ['Ahorros', 'Savings'],
        entertainment: ['Entretenimiento', 'Entertainment']
    };
    document.querySelectorAll('.budget-cat-row').forEach(row => {
        const name = row.querySelector('.budget-cat-name');
        const localized = localizedNames[row.dataset.budgetCategory];
        if (name && localized && localized.includes(name.value.trim())) name.value = localized[english ? 1 : 0];
        if (name) name.setAttribute('aria-label', english ? 'Category name' : 'Nombre de categoría');
        const amount = row.querySelector('.budget-cat-input');
        if (amount) amount.setAttribute('aria-label', english ? 'Category budget' : 'Presupuesto de categoría');
        const removeButton = row.querySelector('.budget-cat-remove');
        if (removeButton) {
            const label = english ? 'Delete category' : 'Eliminar categoría';
            removeButton.setAttribute('aria-label', label);
            removeButton.title = label;
        }
        const editButton = row.querySelector('.budget-cat-edit');
        if (editButton) {
            const editing = row.classList.contains('is-editing');
            editButton.innerHTML = editing
                ? `<i class="fas fa-check" aria-hidden="true"></i><span>${english ? 'Done' : 'Listo'}</span>`
                : `<i class="fas fa-pen" aria-hidden="true"></i><span>${english ? 'Edit' : 'Editar'}</span>`;
            editButton.title = editing
                ? (english ? 'Finish editing category' : 'Terminar edición de categoría')
                : (english ? 'Edit category' : 'Editar categoría');
        }
        const emojiButton = row.querySelector('.budget-cat-icon');
        if (emojiButton) {
            emojiButton.setAttribute('aria-label', `${english ? 'Choose emoji for' : 'Elegir emoji para'} ${name?.value || ''}`);
            emojiButton.title = english ? 'Choose emoji' : 'Elegir emoji';
        }
    });
}

function updateBudgetPriorities(reorder = false, movedRow = null) {
    const list = document.getElementById('budgetCategoriesList');
    if (!list) return;
    let rows = [...list.querySelectorAll('.budget-cat-row')];
    if (reorder) {
        if (movedRow) {
            const requestedPriority = Number(movedRow.querySelector('.budget-cat-priority')?.value || 1);
            rows = rows.filter(row => row !== movedRow);
            rows.splice(Math.max(0, Math.min(rows.length, requestedPriority - 1)), 0, movedRow);
        } else {
            const originalOrder = new Map(rows.map((row, index) => [row, index]));
            rows.sort((a, b) => Number(a.querySelector('.budget-cat-priority')?.value || originalOrder.get(a) + 1) -
                Number(b.querySelector('.budget-cat-priority')?.value || originalOrder.get(b) + 1));
        }
        rows.forEach(row => list.append(row));
    }
    const priorityLabel = window.getCurrentLang?.() === 'en' ? 'Priority' : 'Prioridad';
    rows.forEach((row, index) => {
        const select = row.querySelector('.budget-cat-priority');
        const selectedPriority = Number(select?.value);
        if (select) {
            const nextPriority = reorder ? index + 1 : (Number.isInteger(selectedPriority) ? selectedPriority : index + 1);
            select.replaceChildren();
            rows.forEach((_, optionIndex) => {
                const option = document.createElement('option');
                option.value = String(optionIndex + 1);
                option.textContent = `${priorityLabel} ${optionIndex + 1}`;
                option.selected = optionIndex + 1 === nextPriority;
                select.append(option);
            });
            const nameLabel = window.getCurrentLang?.() === 'en' ? 'Category priority' : 'Prioridad de categoría';
            select.setAttribute('aria-label', `${nameLabel}: ${row.querySelector('.budget-cat-name')?.value.trim() || ''}`);
        }
    });
}

if (typeof cargarDatosFinancieros === 'function') {
    const cargarOriginal = cargarDatosFinancieros;
    cargarDatosFinancieros = async function (...args) {
        const result = await cargarOriginal.apply(this, args);
        evaluarAlertaPresupuesto();
        return result;
    };
}

function confirmLogout() {
    if (typeof window.logout === 'function') void window.logout();
}

/* ============================================================
   UTILES
   ============================================================ */
function escapeHtmlExt(str) {
    if (!str) return '';
    return str.replace(/[&<>"']/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[m]));
}
