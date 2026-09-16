/**
 * Notaire App Features Module
 * Maneja Notificaciones Toast & Centro de Alertas, Filtros de Búsqueda de Tablas y Calendario estilo Google Workspace.
 */

window.NotaireNotifications = (function() {
    const STORAGE_KEY = 'notaire_notifications_v1';

    // Notificaciones por defecto iniciales si el almacenamiento está vacío
    const defaultNotifications = [
        { id: 101, title: 'Trámite Firmado', message: 'Tu Escritura N° 1024 de Compraventa ha sido autenticada.', type: 'tramite', time: 'Hace 10 min', read: false },
        { id: 102, title: 'Movimiento de Saldo', message: 'Recepción de pago de honorarios notariales por $450,000 COP.', type: 'saldo', time: 'Hace 1 hora', read: false },
        { id: 103, title: 'Cita Confirmada', message: 'Cita presencial agendada con el Notario para mañana a las 10:00 AM.', type: 'sistema', time: 'Hace 3 horas', read: true }
    ];

    function getNotifications() {
        try {
            const stored = localStorage.getItem(STORAGE_KEY);
            return stored ? JSON.parse(stored) : defaultNotifications;
        } catch(e) {
            return defaultNotifications;
        }
    }

    function saveNotifications(items) {
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
        } catch(e) {}
    }

    function addNotification(title, message, type = 'sistema') {
        const items = getNotifications();
        const newNotif = {
            id: Date.now(),
            title,
            message,
            type, // 'tramite', 'saldo', 'sistema'
            time: 'Justo ahora',
            read: false
        };
        items.unshift(newNotif);
        saveNotifications(items);
        render();
        showToast(title, message, type);
    }

    function markAllAsRead() {
        const items = getNotifications().map(n => ({ ...n, read: true }));
        saveNotifications(items);
        render();
    }

    function clearAll() {
        saveNotifications([]);
        render();
    }

    function showToast(title, message, type = 'sistema') {
        let toastContainer = document.getElementById('notaireToastContainer');
        if (!toastContainer) {
            toastContainer = document.createElement('div');
            toastContainer.id = 'notaireToastContainer';
            toastContainer.style.cssText = `
                position: fixed;
                bottom: 24px;
                right: 24px;
                z-index: 99999;
                display: flex;
                flex-direction: column;
                gap: 12px;
                max-width: 360px;
            `;
            document.body.appendChild(toastContainer);
        }

        const toast = document.createElement('div');
        const iconMap = {
            tramite: 'fa-file-signature',
            saldo: 'fa-wallet',
            sistema: 'fa-bell'
        };
        const colorMap = {
            tramite: '#A225F5',
            saldo: '#10B981',
            sistema: '#3B82F6'
        };

        toast.style.cssText = `
            background: rgba(26, 26, 36, 0.95);
            border: 1px solid ${colorMap[type] || '#A225F5'};
            border-left: 5px solid ${colorMap[type] || '#A225F5'};
            color: #ffffff;
            padding: 14px 18px;
            border-radius: 12px;
            box-shadow: 0 10px 25px rgba(0,0,0,0.5);
            backdrop-filter: blur(10px);
            display: flex;
            align-items: flex-start;
            gap: 14px;
            transform: translateX(120%);
            transition: all 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275);
            font-family: 'Outfit', sans-serif;
        `;

        toast.innerHTML = `
            <div style="background: ${colorMap[type]}22; color: ${colorMap[type]}; padding: 8px; border-radius: 8px; font-size: 16px;">
                <i class="fas ${iconMap[type] || 'fa-bell'}"></i>
            </div>
            <div style="flex: 1;">
                <div style="font-weight: 600; font-size: 14px; margin-bottom: 2px;">${title}</div>
                <div style="font-size: 12px; opacity: 0.85; line-height: 1.4;">${message}</div>
            </div>
            <button onclick="this.parentElement.remove()" style="background: none; border: none; color: #888; cursor: pointer; font-size: 14px;">&times;</button>
        `;

        toastContainer.appendChild(toast);
        setTimeout(() => { toast.style.transform = 'translateX(0)'; }, 50);
        setTimeout(() => {
            toast.style.transform = 'translateX(120%)';
            setTimeout(() => toast.remove(), 400);
        }, 5000);
    }

    function render() {
        const notifBadge = document.getElementById('notifBadge');
        const notifList = document.getElementById('notifList');
        const items = getNotifications();
        const unreadCount = items.filter(n => !n.read).length;

        if (notifBadge) {
            if (unreadCount > 0) {
                notifBadge.innerText = unreadCount;
                notifBadge.style.display = 'inline-flex';
            } else {
                notifBadge.style.display = 'none';
            }
        }

        if (notifList) {
            if (items.length === 0) {
                notifList.innerHTML = `<div style="padding: 20px; text-align: center; color: #888; font-size: 13px;">No tienes notificaciones pendientes.</div>`;
                return;
            }

            notifList.innerHTML = items.map(n => {
                const iconClass = n.type === 'tramite' ? 'fa-file-signature' : n.type === 'saldo' ? 'fa-wallet' : 'fa-info-circle';
                const bgTag = n.type === 'tramite' ? '#A225F5' : n.type === 'saldo' ? '#10B981' : '#3B82F6';
                return `
                    <div class="notif-item ${n.read ? 'read' : 'unread'}" style="padding: 12px 16px; border-bottom: 1px solid rgba(255,255,255,0.05); display: flex; gap: 12px; align-items: flex-start; background: ${n.read ? 'transparent' : 'rgba(162, 37, 245, 0.08)'}; transition: background 0.2s;">
                        <div style="background: ${bgTag}25; color: ${bgTag}; width: 32px; height: 32px; border-radius: 8px; display: flex; align-items: center; justify-content: center; flex-shrink: 0;">
                            <i class="fas ${iconClass}"></i>
                        </div>
                        <div style="flex: 1;">
                            <div style="font-weight: 600; font-size: 13px; color: #fff; display: flex; justify-content: space-between;">
                                <span>${n.title}</span>
                                <span style="font-size: 10px; color: #aaa; font-weight: normal;">${n.time}</span>
                            </div>
                            <p style="font-size: 12px; color: #bbb; margin: 4px 0 0 0; line-height: 1.3;">${n.message}</p>
                        </div>
                    </div>
                `;
            }).join('');
        }
    }

    return {
        init: function() {
            render();
            const markBtn = document.getElementById('markNotifsRead');
            if (markBtn) markBtn.addEventListener('click', markAllAsRead);
            const clearBtn = document.getElementById('clearNotifs');
            if (clearBtn) clearBtn.addEventListener('click', clearAll);
        },
        add: addNotification,
        markAllAsRead,
        clearAll
    };
})();

/**
 * Filtro Universal para Tablas (Búsqueda y Estado)
 */
window.NotaireTableFilter = function(searchInputId, statusSelectId, tableId) {
    const searchInput = document.getElementById(searchInputId);
    const statusSelect = document.getElementById(statusSelectId);
    const table = document.getElementById(tableId);

    if (!table) return;

    function applyFilter() {
        const query = searchInput ? searchInput.value.toLowerCase().trim() : '';
        const status = statusSelect ? statusSelect.value.toLowerCase().trim() : '';
        const rows = table.querySelectorAll('tbody tr');

        rows.forEach(row => {
            const text = row.innerText.toLowerCase();
            const matchesQuery = !query || text.includes(query);
            const matchesStatus = !status || status === 'todos' || text.includes(status);

            if (matchesQuery && matchesStatus) {
                row.style.display = '';
            } else {
                row.style.display = 'none';
            }
        });
    }

    if (searchInput) searchInput.addEventListener('input', applyFilter);
    if (statusSelect) statusSelect.addEventListener('change', applyFilter);
};

/**
 * Componente Calendario Estilo Google Workspace
 */
window.NotaireCalendar = (function() {
    let currentDate = new Date();
    
    // Citas iniciales demo
    const events = [
        { id: 1, title: 'Firma Escritura N° 1024', date: new Date(new Date().setDate(new Date().getDate() + 1)), time: '10:00 AM', type: 'tramite', desc: 'Firma presencial de compraventa con Notario.' },
        { id: 2, title: 'Revisión Poder Especial', date: new Date(new Date().setDate(new Date().getDate() + 3)), time: '02:30 PM', type: 'cita', desc: 'Validación de documentos del apoderado.' },
        { id: 3, title: 'Pago Arancel de Hipoteca', date: new Date(new Date().setDate(new Date().getDate() + 5)), time: '11:15 AM', type: 'pago', desc: 'Liquidación de derechos notariales.' }
    ];

    function renderCalendar(containerId) {
        const container = document.getElementById(containerId);
        if (!container) return;

        const year = currentDate.getFullYear();
        const month = currentDate.getMonth();
        const monthNames = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];

        const firstDay = new Date(year, month, 1).getDay();
        const daysInMonth = new Date(year, month + 1, 0).getDate();

        container.innerHTML = `
            <div class="calendar-workspace" style="background: rgba(20, 20, 30, 0.6); border: 1px solid rgba(255,255,255,0.08); border-radius: 16px; padding: 20px; color: #fff; backdrop-filter: blur(12px);">
                <!-- Header del Calendario -->
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; flex-wrap: wrap; gap: 12px;">
                    <div style="display: flex; align-items: center; gap: 16px;">
                        <h2 style="margin: 0; font-size: 20px; font-weight: 600;"><i class="far fa-calendar-alt" style="color: #A225F5; margin-right: 8px;"></i> ${monthNames[month]} ${year}</h2>
                        <div style="display: flex; gap: 6px;">
                            <button id="calPrevBtn" style="background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); color: #fff; border-radius: 8px; width: 34px; height: 34px; cursor: pointer;"><i class="fas fa-chevron-left"></i></button>
                            <button id="calTodayBtn" style="background: rgba(162, 37, 245, 0.2); border: 1px solid #A225F5; color: #fff; border-radius: 8px; padding: 0 12px; height: 34px; font-size: 12px; font-weight: 600; cursor: pointer;">Hoy</button>
                            <button id="calNextBtn" style="background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); color: #fff; border-radius: 8px; width: 34px; height: 34px; cursor: pointer;"><i class="fas fa-chevron-right"></i></button>
                        </div>
                    </div>
                    <button id="btnNewAppointment" style="background: linear-gradient(135deg, #A225F5, #8C00FF); border: none; color: #fff; font-weight: 600; font-size: 13px; padding: 10px 18px; border-radius: 10px; cursor: pointer; box-shadow: 0 4px 15px rgba(162, 37, 245, 0.4); display: flex; align-items: center; gap: 8px;">
                        <i class="fas fa-plus"></i> Agendar Cita Notarial
                    </button>
                </div>

                <!-- Días de la semana -->
                <div style="display: grid; grid-template-columns: repeat(7, 1fr); text-align: center; font-size: 12px; font-weight: 600; color: #888; padding-bottom: 10px; border-bottom: 1px solid rgba(255,255,255,0.05);">
                    <div>Dom</div><div>Lun</div><div>Mar</div><div>Mié</div><div>Jue</div><div>Vie</div><div>Sáb</div>
                </div>

                <!-- Matriz de Días -->
                <div id="calendarDaysGrid" style="display: grid; grid-template-columns: repeat(7, 1fr); gap: 6px; margin-top: 10px;"></div>
            </div>
        `;

        const grid = document.getElementById('calendarDaysGrid');
        
        // Celdas vacías previas
        for (let i = 0; i < firstDay; i++) {
            grid.appendChild(document.createElement('div'));
        }

        const today = new Date();
        for (let day = 1; day <= daysInMonth; day++) {
            const dayCell = document.createElement('div');
            const cellDate = new Date(year, month, day);
            const isToday = cellDate.toDateString() === today.toDateString();

            dayCell.style.cssText = `
                min-height: 80px;
                background: ${isToday ? 'rgba(162, 37, 245, 0.12)' : 'rgba(255,255,255,0.02)'};
                border: 1px solid ${isToday ? '#A225F5' : 'rgba(255,255,255,0.05)'};
                border-radius: 10px;
                padding: 6px;
                display: flex;
                flex-direction: column;
                gap: 4px;
                transition: transform 0.2s, background 0.2s;
            `;

            dayCell.innerHTML = `
                <div style="font-size: 12px; font-weight: ${isToday ? '700' : '500'}; color: ${isToday ? '#A225F5' : '#ccc'}; text-align: right;">${day}</div>
            `;

            // Buscar eventos para este día
            const dayEvents = events.filter(e => e.date.toDateString() === cellDate.toDateString());
            dayEvents.forEach(ev => {
                const evTag = document.createElement('div');
                const tagColor = ev.type === 'tramite' ? '#A225F5' : ev.type === 'pago' ? '#10B981' : '#3B82F6';
                evTag.style.cssText = `
                    background: ${tagColor}25;
                    border-left: 3px solid ${tagColor};
                    color: #fff;
                    font-size: 10px;
                    padding: 3px 6px;
                    border-radius: 4px;
                    white-space: nowrap;
                    overflow: hidden;
                    text-overflow: ellipsis;
                    cursor: pointer;
                `;
                evTag.innerText = `${ev.time} ${ev.title}`;
                evTag.title = `${ev.title} - ${ev.desc}`;
                dayCell.appendChild(evTag);
            });

            grid.appendChild(dayCell);
        }

        // Listeners de navegación
        document.getElementById('calPrevBtn').addEventListener('click', () => {
            currentDate.setMonth(currentDate.getMonth() - 1);
            renderCalendar(containerId);
        });
        document.getElementById('calNextBtn').addEventListener('click', () => {
            currentDate.setMonth(currentDate.getMonth() + 1);
            renderCalendar(containerId);
        });
        document.getElementById('calTodayBtn').addEventListener('click', () => {
            currentDate = new Date();
            renderCalendar(containerId);
        });
        document.getElementById('btnNewAppointment').addEventListener('click', () => {
            showNewAppointmentModal(containerId);
        });
    }

    function showNewAppointmentModal(containerId) {
        const modal = document.createElement('div');
        modal.style.cssText = `
            position: fixed; top: 0; left: 0; width: 100vw; height: 100vh;
            background: rgba(0,0,0,0.7); backdrop-filter: blur(8px);
            z-index: 99999; display: flex; align-items: center; justify-content: center;
        `;
        modal.innerHTML = `
            <div style="background: #161622; border: 1px solid rgba(255,255,255,0.1); padding: 24px; border-radius: 16px; width: 90%; max-width: 420px; color: #fff; font-family: 'Outfit', sans-serif;">
                <h3 style="margin-top: 0; font-size: 18px;"><i class="far fa-calendar-plus" style="color: #A225F5;"></i> Nueva Cita Notarial</h3>
                <div style="margin-bottom: 12px;">
                    <label style="font-size: 12px; color: #aaa; display: block; margin-bottom: 4px;">Asunto del Trámite</label>
                    <input type="text" id="appTitle" placeholder="Ej. Firma de Escritura" style="width: 100%; background: #0c0c14; border: 1px solid rgba(255,255,255,0.1); color: #fff; padding: 10px; border-radius: 8px;">
                </div>
                <div style="display: flex; gap: 10px; margin-bottom: 12px;">
                    <div style="flex: 1;">
                        <label style="font-size: 12px; color: #aaa; display: block; margin-bottom: 4px;">Fecha</label>
                        <input type="date" id="appDate" style="width: 100%; background: #0c0c14; border: 1px solid rgba(255,255,255,0.1); color: #fff; padding: 10px; border-radius: 8px;">
                    </div>
                    <div style="flex: 1;">
                        <label style="font-size: 12px; color: #aaa; display: block; margin-bottom: 4px;">Hora</label>
                        <input type="time" id="appTime" value="10:00" style="width: 100%; background: #0c0c14; border: 1px solid rgba(255,255,255,0.1); color: #fff; padding: 10px; border-radius: 8px;">
                    </div>
                </div>
                <div style="margin-bottom: 20px;">
                    <label style="font-size: 12px; color: #aaa; display: block; margin-bottom: 4px;">Modalidad</label>
                    <select id="appType" style="width: 100%; background: #0c0c14; border: 1px solid rgba(255,255,255,0.1); color: #fff; padding: 10px; border-radius: 8px;">
                        <option value="tramite">Presencial en Notaría</option>
                        <option value="cita">Virtual (Videollamada Notarial)</option>
                    </select>
                </div>
                <div style="display: flex; justify-content: flex-end; gap: 10px;">
                    <button id="cancelAppBtn" style="background: rgba(255,255,255,0.1); border: none; color: #fff; padding: 8px 16px; border-radius: 8px; cursor: pointer;">Cancelar</button>
                    <button id="saveAppBtn" style="background: #A225F5; border: none; color: #fff; font-weight: 600; padding: 8px 16px; border-radius: 8px; cursor: pointer;">Guardar Cita</button>
                </div>
            </div>
        `;
        document.body.appendChild(modal);

        document.getElementById('cancelAppBtn').addEventListener('click', () => modal.remove());
        document.getElementById('saveAppBtn').addEventListener('click', () => {
            const title = document.getElementById('appTitle').value.trim() || 'Cita Notarial';
            const dateStr = document.getElementById('appDate').value;
            const timeStr = document.getElementById('appTime').value;
            const type = document.getElementById('appType').value;

            if (dateStr) {
                const eventDate = new Date(dateStr + 'T' + timeStr);
                events.push({
                    id: Date.now(),
                    title: title,
                    date: eventDate,
                    time: timeStr,
                    type: type,
                    desc: 'Cita programada desde el panel'
                });

                if (window.NotaireNotifications) {
                    window.NotaireNotifications.add('Nueva Cita Agendada', `Se programó "${title}" para el ${dateStr} a las ${timeStr}.`, 'sistema');
                }
            }
            modal.remove();
            renderCalendar(containerId);
        });
    }

    return {
        init: renderCalendar
    };
})();
