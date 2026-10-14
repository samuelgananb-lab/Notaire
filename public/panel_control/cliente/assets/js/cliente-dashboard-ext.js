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
    events: [
        { id: 1, titulo: 'Pago Arancel Notarial', tipo: 'green', fecha: '2026-08-10', hora: '11:15', nota: 'Banco de Bogotá', notif24h: true, notif1h: true },
        { id: 2, titulo: 'Renovación Documento', tipo: 'orange', fecha: '2026-08-13', hora: '09:00', nota: 'Cédula de ciudadanía', notif24h: true, notif1h: false },
        { id: 3, titulo: 'Cumpleaños María', tipo: 'pink', fecha: '2026-08-15', hora: '16:00', nota: 'Celebración', notif24h: true, notif1h: false },
        { id: 4, titulo: 'Revisar Poder Especial', tipo: 'purple', fecha: '2026-08-17', hora: '14:30', nota: 'Documento legal', notif24h: true, notif1h: true },
        { id: 5, titulo: 'Firma Escritura', tipo: 'purple', fecha: '2026-08-20', hora: '10:00', nota: 'Notaría 12 – Centro', notif24h: true, notif1h: true },
        { id: 6, titulo: 'Pago Hipoteca', tipo: 'green', fecha: '2026-08-27', hora: '11:15', nota: 'Bancolombia', notif24h: true, notif1h: false },
    ],
    currentEventId: null
};

const typeColorMap = {
    purple: { bg: 'rgba(140, 0, 255, 0.4)', border: '#8c00ff', dot: '#8c00ff', label: 'Notarial' },
    green:  { bg: 'rgba(16, 185, 129, 0.3)',  border: '#10b981', dot: '#10b981', label: 'Financiero' },
    orange: { bg: 'rgba(245, 158, 11, 0.3)',  border: '#f59e0b', dot: '#f59e0b', label: 'Recordatorio' },
    blue:   { bg: 'rgba(6, 182, 212, 0.3)',   border: '#06b6d4', dot: '#06b6d4', label: 'Personal' },
    pink:   { bg: 'rgba(236, 72, 153, 0.3)',  border: '#ec4899', dot: '#ec4899', label: 'Cumpleaños' },
};

const MONTH_NAMES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];

/* ============================================================
   INICIALIZACIÓN
   ============================================================ */
document.addEventListener('DOMContentLoaded', () => {
    initCalendar();
    initMetasView();
    initConfigView();
    initEmojiPicker();
    setupNavigateTo();
    requestBrowserNotifications();
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
        const tiposVisuales = { notarial: 'purple', financiero: 'green', recordatorio: 'orange', personal: 'blue', cumpleanos: 'pink' };
        CalendarState.events = eventos.map(evento => ({
            ...evento,
            tipo: tiposVisuales[evento.tipo] || evento.tipo || 'purple',
            fecha: evento.fecha || String(evento.fecha_hora || '').slice(0, 10),
            hora: evento.hora || String(evento.fecha_hora || '').slice(11, 16),
            notif24h: evento.notif24h !== false,
            notif1h: evento.notif1h !== false,
            notifOnDay: evento.notifonday === true
        }));
        renderCalendar();
        CalendarState.events.forEach(scheduleEventNotifications);
    } catch (error) {
        console.error('Error cargando eventos persistidos:', error);
    }
}

/* ============================================================
   NAVEGACIÓN HELPER
   ============================================================ */
function navigateTo(viewId) {
    document.querySelectorAll('#sidebarMenu li').forEach(li => li.classList.remove('active'));
    document.querySelectorAll('.content-section').forEach(sec => sec.classList.remove('active'));

    const targetSection = document.getElementById(viewId);
    if (targetSection) targetSection.classList.add('active');

    const link = document.querySelector(`#sidebarMenu a[data-target="${viewId}"]`);
    if (link) link.parentElement.classList.add('active');

    const currentLang = (typeof getCurrentLang === 'function') ? getCurrentLang() : (localStorage.getItem('notaire_lang') || 'es');
    const titlesObj = (window.translations && window.translations[currentLang] && window.translations[currentLang].titles) ? window.translations[currentLang].titles : {
        'view-gastos': 'MIS GASTOS',
        'view-ingresos': 'MIS INGRESOS',
        'view-ahorros': 'MIS AHORROS',
        'view-saldo': 'MI SALDO',
        'view-inicio': 'PANEL PRINCIPAL',
        'view-metas': 'GESTIÓN DE METAS',
        'view-recordatorios': 'CALENDARIO NOTARIAL',
        'view-configuracion': 'CONFIGURACIÓN'
    };
    const headerTitle = document.getElementById('headerDynamicTitle');
    if (headerTitle && titlesObj[viewId]) headerTitle.textContent = titlesObj[viewId];

    // Refrescar calendario al entrar
    if (viewId === 'view-recordatorios') renderCalendar();
    if (viewId === 'view-metas') {
        if (typeof cargarMetasYAhorros === 'function') cargarMetasYAhorros();
    }
    if (viewId === 'view-configuracion') refreshConfigDisplay();
    if (viewId === 'view-inicio' && typeof updateHeroGreeting === 'function') updateHeroGreeting();
}

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
        CalendarState.currentDate = new Date(d.getFullYear(), d.getMonth() - 1, 1);
        renderCalendar();
    });
    document.getElementById('btnCalNext')?.addEventListener('click', () => {
        const d = CalendarState.currentDate;
        CalendarState.currentDate = new Date(d.getFullYear(), d.getMonth() + 1, 1);
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

    renderCalendar();
}

function renderCalendar() {
    const d = CalendarState.currentDate;
    const year = d.getFullYear();
    const month = d.getMonth();
    const today = new Date();

    // Actualizar título
    const titleEl = document.getElementById('calMonthTitle');
    if (titleEl) titleEl.innerHTML = `${MONTH_NAMES[month]} ${year} <i class="fas fa-chevron-down" style="font-size:14px;"></i>`;

    renderMonthGrid(year, month, today);
    renderUpcomingEvents();
    renderMonthSummary(year, month);
}

function renderMonthGrid(year, month, today) {
    const grid = document.getElementById('calendarMonthGrid');
    if (!grid) return;

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

    // Agregar eventos de este día
    if (!otherMonth) {
        const dayEvents = CalendarState.events.filter(e => e.fecha === dateStr);
        dayEvents.forEach(evt => {
            const colors = typeColorMap[evt.tipo] || typeColorMap.purple;
            const pill = document.createElement('div');
            pill.className = 'cal-event-pill';
            pill.style.background = colors.bg;
            pill.style.border = `1px solid ${colors.border}`;
            pill.textContent = (evt.hora ? evt.hora + ' ' : '') + evt.titulo;
            pill.addEventListener('click', (e) => {
                e.stopPropagation();
                openDetalleEvento(evt.id);
            });
            cell.appendChild(pill);
        });

        // Click en celda para crear evento
        cell.addEventListener('click', () => {
            const fechaInput = document.getElementById('eventoFecha');
            if (fechaInput) fechaInput.value = dateStr;
            openModalNuevoEvento();
        });
    }

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
        .sort((a, b) => a.fecha.localeCompare(b.fecha))
        .slice(0, 5);

    if (upcoming.length === 0) {
        container.innerHTML = `<div style="text-align:center; padding: 20px; color: var(--color-text-muted);">
            <i class="fas fa-calendar-check" style="font-size:28px; opacity:0.4; display:block; margin-bottom:8px;"></i>
            Sin eventos próximos
        </div>`;
        return;
    }

    container.innerHTML = upcoming.map(evt => {
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
                        <span class="event-title">${escapeHtmlExt(evt.titulo)}</span>
                        <span class="event-subtext">${evt.nota || ''}</span>
                        <span class="event-subtext" style="color: ${colors.dot};">
                            <i class="fas fa-clock" style="font-size:10px;"></i> ${dateLabel}${evt.hora ? ', ' + evt.hora : ''}
                        </span>
                    </div>
                </div>
                <button class="icon-btn-action" style="width:32px; height:32px;" onclick="toggleEventNotif(event, ${evt.id})">
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
        { icon: '📅', color: '#8c00ff', val: counts.total, lbl: 'Eventos' },
        { icon: '💳', color: '#10b981', val: counts.pagos, lbl: 'Pagos' },
        { icon: '🔔', color: '#f59e0b', val: counts.recordatorios, lbl: 'Recordatorio' },
        { icon: '👤', color: '#06b6d4', val: counts.personal, lbl: 'Personal' },
    ];

    container.innerHTML = items.map(item => `
        <div class="summary-mini-card">
            <div class="mini-card-icon" style="background: rgba(${hexToRgb(item.color)}, 0.15); font-size: 20px;">${item.icon}</div>
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
        const newEvt = result.evento;
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
                    <div style="font-size: 16px; font-weight:700; color:#fff;">${escapeHtmlExt(evt.titulo)}</div>
                    <div style="font-size: 13px; color: ${colors.dot};">${colors.label} • ${dateLabel}${evt.hora ? ' a las ' + evt.hora : ''}</div>
                </div>
            </div>
            ${evt.nota ? `<div style="padding:14px; background: rgba(255,255,255,0.03); border-radius:12px; font-size:14px; color: var(--color-text-muted);">
                <i class="fas fa-sticky-note" style="margin-right:8px; color: var(--color-secondary-light);"></i>${escapeHtmlExt(evt.nota)}
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

function toggleEventNotif(e, id) {
    e.stopPropagation();
    const evt = CalendarState.events.find(ev => ev.id === id);
    if (!evt) return;
    evt.notif24h = !evt.notif24h;
    evt.notif1h = !evt.notif1h;
    renderUpcomingEvents();
    showToast(evt.notif24h ? '🔔 Notificaciones activadas para el evento.' : '🔕 Notificaciones desactivadas.');
}

/* ============================================================
   NOTIFICACIONES DEL SISTEMA
   ============================================================ */
function requestBrowserNotifications() {
    if ('Notification' in window && Notification.permission === 'default') {
        Notification.requestPermission();
    }
}

function scheduleEventNotifications(evt) {
    if (!evt.fecha) return;
    const evtDateTime = new Date(`${evt.fecha}T${evt.hora || '08:00'}:00`);
    const cfg = notifCfg();

    if (evt.notif24h && cfg.h24) {
        const notif24 = new Date(evtDateTime.getTime() - 24 * 60 * 60 * 1000);
        scheduleNotification(notif24, `📅 Recordatorio mañana: ${evt.titulo}`, evt.nota || '');
    }
    if (evt.notif1h && cfg.h1) {
        const notif1 = new Date(evtDateTime.getTime() - 60 * 60 * 1000);
        scheduleNotification(notif1, `⏰ En 1 hora: ${evt.titulo}`, evt.nota || '');
    }
    if (evt.notifOnDay) {
        scheduleNotification(evtDateTime, `🔔 Ahora: ${evt.titulo}`, evt.nota || '');
    }
}

function scheduleNotification(triggerTime, title, body) {
    const now = new Date();
    const delay = triggerTime.getTime() - now.getTime();
    if (delay <= 0) return;

    if (delay < 48 * 60 * 60 * 1000) { // Solo si es en menos de 48h
        setTimeout(() => {
            triggerSystemNotif(title, body);
        }, delay);
    }
}

const recentNotifs = new Map();

function triggerSystemNotif(title, body) {
    const last = recentNotifs.get(title);
    if (last && Date.now() - last < 5 * 60 * 1000) return;
    recentNotifs.set(title, Date.now());

    // Notificación del navegador
    if (notifCfg().browser && 'Notification' in window && Notification.permission === 'granted') {
        new Notification(title, {
            body: body,
            icon: '/public/assets/image/notaire-icon.png',
            badge: '/public/assets/image/notaire-icon.png'
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

function scheduleNotificationChecks() {
    // Revisar cada minuto los eventos próximos para mostrar recordatorios de demostración
    setInterval(() => {
        const now = new Date();
        CalendarState.events.forEach(evt => {
            if (!evt.fecha || !evt.hora) return;
            const evtTime = new Date(`${evt.fecha}T${evt.hora}:00`);
            const diffMin = (evtTime - now) / 60000;

            // 24h antes (entre 1439 y 1441 minutos)
            if (evt.notif24h && notifCfg().h24 && diffMin > 1438 && diffMin < 1442) {
                triggerSystemNotif(`📅 Recordatorio mañana: ${evt.titulo}`, evt.nota || '');
            }
            // 1h antes (entre 59 y 61 minutos)
            if (evt.notif1h && notifCfg().h1 && diffMin > 58 && diffMin < 62) {
                triggerSystemNotif(`⏰ En 1 hora: ${evt.titulo}`, evt.nota || '');
            }
            if (evt.notifOnDay && diffMin > -1 && diffMin < 1) {
                triggerSystemNotif(`🔔 Ahora: ${evt.titulo}`, evt.nota || '');
            }
        });
    }, 60000);
}

function openNotifSettings() {
    navigateTo('view-configuracion');
    setTimeout(() => {
        const notifCard = document.querySelector('.config-card');
        if (notifCard) notifCard.scrollIntoView({ behavior: 'smooth' });
    }, 400);
}

/* ============================================================
   METAS – Vista completa
   ============================================================ */
function initMetasView() {
    if (typeof cargarMetasYAhorros === 'function') cargarMetasYAhorros();
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
        picker.querySelectorAll('.emoji-opt').forEach(o => o.classList.remove('selected'));
        opt.classList.add('selected');
        const iconInput = document.getElementById('metaIcono');
        if (iconInput) iconInput.value = opt.dataset.emoji;
    });
}

/* ============================================================
   CONFIGURACIÓN
   ============================================================ */
function initConfigView() {
    refreshConfigDisplay();
    cargarPreferenciasNotificacion();
}

function refreshConfigDisplay() {
    if (typeof NotaireState === 'undefined') return;
    const configNombre = document.getElementById('configNombre');
    const configEmail = document.getElementById('configEmail');
    const configAvatar = document.getElementById('configAvatarLarge');
    if (configNombre) configNombre.textContent = NotaireState.user.nombre;
    if (configEmail) configEmail.textContent = NotaireState.user.email;
    if (configAvatar) configAvatar.textContent = NotaireState.user.iniciales || 'SG';
}

function setThemeSwatch(themeName, el) {
    document.querySelectorAll('.theme-swatch').forEach(s => s.classList.remove('active'));
    el.classList.add('active');
    showToast(`🎨 Tema "${themeName}" aplicado.`);
}

function setDisplayMode(mode, el) {
    if (typeof window.setDisplayMode === 'function' && window.setDisplayMode !== setDisplayMode) {
        window.setDisplayMode(mode, el);
        return;
    }
    document.querySelectorAll('.config-toggle-opt').forEach(o => o.classList.remove('active'));
    if (el) el.classList.add('active');
}

function toggleNotifBrowser(input) {
    if (input.checked) {
        requestBrowserNotifications();
        showToast('🔔 Notificaciones del navegador activadas.');
    } else {
        showToast('🔕 Notificaciones del navegador desactivadas.');
    }
    saveNotifConfig();
}

function notifCfg() {
    const defaults = { browser: true, h24: true, h1: true, gastos: true, semanal: false };
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
    set('togNotif24h', cfg.h24);
    set('togNotif1h', cfg.h1);
    set('togNotifGastos', cfg.gastos);
    set('togNotifSemanal', cfg.semanal);
    const budgetInput = document.getElementById('cfgPresupuesto');
    if (budgetInput && presupuesto > 0) budgetInput.value = presupuesto;
}

async function cargarPreferenciasNotificacion() {
    applyNotifConfigToUI(notifCfg(), Number(localStorage.getItem('notaire_presupuesto') || 0));
    if (!localStorage.getItem('notaire_token')) return;
    try {
        const response = await fetch('/api/auth/preferencias', { headers: authHeadersExt() });
        if (!response.ok) return;
        const { presupuesto, ...cfg } = await response.json();
        localStorage.setItem('notaire_notif_cfg', JSON.stringify(cfg));
        if (presupuesto > 0) localStorage.setItem('notaire_presupuesto', String(presupuesto));
        applyNotifConfigToUI(cfg, presupuesto);
        if (typeof cargarDatosFinancieros === 'function') cargarDatosFinancieros();
    } catch (error) {
        console.error('No se pudieron cargar las preferencias de notificación:', error);
    }
}

async function persistirPreferencias() {
    if (!localStorage.getItem('notaire_token')) return;
    try {
        await fetch('/api/auth/preferencias', {
            method: 'PUT',
            headers: authHeadersExt(),
            body: JSON.stringify({ ...notifCfg(), presupuesto: Number(localStorage.getItem('notaire_presupuesto') || 0) })
        });
    } catch (error) {
        console.error('No se pudieron guardar las preferencias de notificación:', error);
    }
}

function saveNotifConfig() {
    const cfg = {
        browser: document.getElementById('togNotifBrowser')?.checked,
        h24: document.getElementById('togNotif24h')?.checked,
        h1: document.getElementById('togNotif1h')?.checked,
        gastos: document.getElementById('togNotifGastos')?.checked,
        semanal: document.getElementById('togNotifSemanal')?.checked,
    };
    localStorage.setItem('notaire_notif_cfg', JSON.stringify(cfg));
    persistirPreferencias();
}

function saveRegionConfig() {
    const idioma = document.getElementById('cfgIdioma')?.value;
    const moneda = document.getElementById('cfgMoneda')?.value;
    localStorage.setItem('notaire_region', JSON.stringify({ idioma, moneda }));
    showToast(`✅ Preferencias de región guardadas.`);
}

function saveBudgetConfig() {
    const total = Number(document.getElementById('cfgPresupuesto')?.value);
    if (!Number.isFinite(total) || total <= 0) {
        showToast('⚠️ Ingresa un presupuesto mensual válido.');
        return;
    }
    localStorage.setItem('notaire_presupuesto', String(Math.round(total)));
    localStorage.removeItem('notaire_budget_alert');
    persistirPreferencias();
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
    const key = `${new Date().toISOString().slice(0, 7)}:${nivel}`;
    if (localStorage.getItem('notaire_budget_alert') === key) return;
    localStorage.setItem('notaire_budget_alert', key);
    triggerSystemNotif(
        nivel === 100 ? '🚨 Superaste tu presupuesto mensual' : '⚠️ Estás cerca de tu presupuesto',
        `Has usado el ${Math.round(pct)}% de tu presupuesto de este mes.`
    );
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
    if (confirm('¿Seguro que deseas cerrar sesión?')) {
        window.location.href = '../../auth/login.html';
    }
}

/* ============================================================
   UTILES
   ============================================================ */
function escapeHtmlExt(str) {
    if (!str) return '';
    return str.replace(/[&<>"']/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[m]));
}
