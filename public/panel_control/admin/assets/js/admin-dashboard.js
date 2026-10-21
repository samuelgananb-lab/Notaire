/**
 * NOTAIRE SYSTEM - DASHBOARD CONTROLLER & INTERACTIVE ENGINE
 * 
 * Gestiona el cambio de vistas SPA, renderizado de gráficos Chart.js,
 * cálculo dinámico de métricas y la funcionalidad completa de cada botón.
 */

// Estado Global de la Aplicación
const NotaireState = {
    user: { nombre: '', email: '', telefono: '', documento: '', iniciales: '' },
    gastos: [],
    ingresos: [],
    metas: [],
    ahorrosRecientes: [],
    presupuestoTotal: 0
};

document.addEventListener('DOMContentLoaded', () => {
    if (window.matchMedia('(max-width: 900px)').matches) {
        document.querySelector('.sidebar')?.classList.add('collapsed');
    }
});

document.addEventListener('DOMContentLoaded', () => {
    const mobileTrigger = document.getElementById('mobileMenuTrigger');
    const sidebar = document.querySelector('.sidebar');
    const backdrop = document.getElementById('mobileSidebarBackdrop');
    if (!mobileTrigger || !sidebar) return;
    mobileTrigger.addEventListener('click', toggleSidebar);
    backdrop?.addEventListener('click', () => {
        sidebar.classList.remove('mobile-open');
        backdrop.classList.remove('visible');
        mobileTrigger.setAttribute('aria-expanded', 'false');
    });
    document.querySelectorAll('#sidebarMenu a[data-target]').forEach(link => link.addEventListener('click', () => {
        if (window.matchMedia('(max-width: 768px)').matches) {
            sidebar.classList.remove('mobile-open');
            backdrop?.classList.remove('visible');
            mobileTrigger.setAttribute('aria-expanded', 'false');
        }
    }));
});

// Referencias a Gráficos Instanciados
let chartGastosDonaInstance = null;
let chartEvolucionIngresosInstance = null;
let chartFuentesIngresosInstance = null;
let chartPatrimonioEvolucionInstance = null;
let chartDistribucionActivosInstance = null;

// Inicialización de la Aplicación
document.addEventListener('DOMContentLoaded', () => {
    initNavigation();
    initCharts();
    updateAllMetrics();
    if (typeof setupCurrentDates === 'function') setupCurrentDates();
    // Restaurar estado del sidebar
    if (localStorage.getItem('notaire_sidebar_collapsed') === '1') {
        const sidebar = document.querySelector('.sidebar');
        if (sidebar) sidebar.classList.add('collapsed');
    }
    if (window.matchMedia('(max-width: 900px)').matches) {
        document.querySelector('.sidebar')?.classList.add('collapsed');
    }
});

/* ==========================================================================
   1. NAVEGACIÓN Y SPA TABS
   ========================================================================== */
function initSidebarSubmenus() {
    document.querySelectorAll('#sidebarMenu .submenu-toggle').forEach(toggle => {
        toggle.addEventListener('click', (e) => {
            e.preventDefault();
            const parentLi = toggle.closest('.has-submenu');
            if (!parentLi) return;
            const willOpen = !parentLi.classList.contains('open');
            document.querySelectorAll('#sidebarMenu .has-submenu.open').forEach(li => {
                if (li !== parentLi) li.classList.remove('open');
            });
            parentLi.classList.toggle('open', willOpen);
        });
    });
}

function initNavigation() {
    initSidebarSubmenus();
    const menuItems = document.querySelectorAll('#sidebarMenu li a[data-target]');
    
    menuItems.forEach(item => {
        item.addEventListener('click', (e) => {
            e.preventDefault();
            const targetViewId = item.getAttribute('data-target');
            if (!targetViewId) return;

            // Cambiar clase activa en menú
            document.querySelectorAll('#sidebarMenu li').forEach(li => li.classList.remove('active'));
            item.parentElement.classList.add('active');

            // Mantener expandido el submenú del enlace activo
            const parentSubmenu = item.closest('.has-submenu');
            if (parentSubmenu) parentSubmenu.classList.add('open');

            // Cambiar vista activa
            document.querySelectorAll('.content-section').forEach(sec => sec.classList.remove('active'));
            const targetSection = document.getElementById(targetViewId);
            if (targetSection) {
                targetSection.classList.add('active');
            }

            // Actualizar título en top header respetando idioma activo
            const currentLang = (typeof getCurrentLang === 'function') ? getCurrentLang() : (localStorage.getItem('notaire_lang') || 'es');
            const titlesObj = (window.translations && window.translations[currentLang] && window.translations[currentLang].titles) ? window.translations[currentLang].titles : {
                'view-usuarios': 'GESTIÓN DE USUARIOS',
                'view-tramites': 'TRÁMITES NOTARIALES',
                'view-auditoria': 'AUDITORÍA',
                'view-notificaciones': 'CENTRO DE NOTIFICACIONES',
                'view-reportes': 'REPORTES',
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
            if (headerTitle && titlesObj[targetViewId]) {
                headerTitle.textContent = titlesObj[targetViewId];
            }

            if (targetViewId === 'view-inicio' && typeof updateHeroGreeting === 'function') {
                updateHeroGreeting();
            }

            // Refrescar vistas interactivas extendidas si existen
            if (targetViewId === 'view-recordatorios' && typeof renderCalendar === 'function') {
                renderCalendar();
            }
            if (targetViewId === 'view-metas' && typeof renderMetasView === 'function') {
                renderMetasView();
            }
            if (targetViewId === 'view-configuracion' && typeof refreshConfigDisplay === 'function') {
                refreshConfigDisplay();
            }

            // Renderizar / Refrescar gráficos de la vista seleccionada
            setTimeout(() => {
                refreshActiveViewCharts(targetViewId);
            }, 100);
        });
    });
}

function refreshActiveViewCharts(viewId) {
    if (viewId === 'view-gastos' && chartGastosDonaInstance) {
        chartGastosDonaInstance.resize();
    } else if (viewId === 'view-ingresos') {
        if (chartEvolucionIngresosInstance) chartEvolucionIngresosInstance.resize();
        if (chartFuentesIngresosInstance) chartFuentesIngresosInstance.resize();
    } else if (viewId === 'view-saldo') {
        if (chartPatrimonioEvolucionInstance) chartPatrimonioEvolucionInstance.resize();
        if (chartDistribucionActivosInstance) chartDistribucionActivosInstance.resize();
    }
}

/* ==========================================================================
   2. INICIALIZACIÓN DE GRÁFICOS CHART.JS
   ========================================================================== */
function initCharts() {
    Chart.defaults.color = 'rgba(255, 255, 255, 0.65)';
    Chart.defaults.font.family = "'Outfit', sans-serif";

    // 1. Gráfico Dona: ¿En qué gastas más? (Gastos)
    const ctxGastos = document.getElementById('chartGastosDona');
    if (ctxGastos) {
        chartGastosDonaInstance = new Chart(ctxGastos.getContext('2d'), {
            type: 'doughnut',
            data: {
                    labels: [],
                datasets: [{
                    data: [],
                    backgroundColor: ['#f59e0b', '#8b5cf6', '#06b6d4', '#10b981', '#64748b'],
                    borderWidth: 0,
                    hoverOffset: 6
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                cutout: '72%',
                plugins: { legend: { display: false }, tooltip: { enabled: true } }
            }
        });
    }

    // 2. Gráfico de Línea: Evolución de ingresos (Ingresos)
    const ctxIngEvol = document.getElementById('chartEvolucionIngresos');
    if (ctxIngEvol && window.NotaireFinancialChart) {
        const series = window.NotaireFinancialChart.createMonthlyTotals([], 'ingreso');
        chartEvolucionIngresosInstance = new Chart(
            ctxIngEvol.getContext('2d'),
            window.NotaireFinancialChart.createConfig(series.labels, series.values, adminCurrency, 'Ingresos')
        );
    }

    // 3. Gráfico Dona: Fuentes de Ingresos (Ingresos)
    const ctxIngFuentes = document.getElementById('chartFuentesIngresos');
    if (ctxIngFuentes) {
        chartFuentesIngresosInstance = new Chart(ctxIngFuentes.getContext('2d'), {
            type: 'doughnut',
            data: {
                labels: [],
                datasets: [{
                    data: [],
                    backgroundColor: ['#3b82f6', '#06b6d4', '#8b5cf6', '#10b981'],
                    borderWidth: 0,
                    hoverOffset: 6
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                cutout: '72%',
                plugins: { legend: { display: false } }
            }
        });
    }

    // 4. Gráfico de Área: Evolución del Patrimonio (Saldo)
    const ctxPatrimonio = document.getElementById('chartPatrimonioEvolucion');
    if (ctxPatrimonio && window.NotaireFinancialChart) {
        const series = window.NotaireFinancialChart.createMonthlySeries([]);
        chartPatrimonioEvolucionInstance = new Chart(
            ctxPatrimonio.getContext('2d'),
            window.NotaireFinancialChart.createConfig(series.labels, series.values, adminCurrency)
        );
    }

    // 5. Gráfico Dona: Distribución de Activos (Saldo)
    const ctxDistrib = document.getElementById('chartDistribucionActivos');
    if (ctxDistrib) {
        chartDistribucionActivosInstance = new Chart(ctxDistrib.getContext('2d'), {
            type: 'doughnut',
            data: {
                labels: [],
                datasets: [{
                    data: [],
                    backgroundColor: ['#3b82f6', '#06b6d4', '#f59e0b', '#64748b'],
                    borderWidth: 0,
                    hoverOffset: 6
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                cutout: '72%',
                plugins: { legend: { display: false } }
            }
        });
    }
}

/* ==========================================================================
   3. CÁLCULO DINÁMICO DE MÉTRICAS Y ACTUALIZACIÓN DE INTERFAZ
   ========================================================================== */
function updateAllMetrics() {
    const monthKey = window.NotaireFinancialChart?.currentMonthKey();
    const inCurrentMonth = transaction => String(transaction.fecha || '').slice(0, 7) === monthKey;
    const sumAmounts = transactions => transactions.reduce((total, transaction) => {
        const amount = Number(transaction.monto);
        return total + (Number.isFinite(amount) && amount > 0 ? amount : 0);
    }, 0);
    const gastosMes = NotaireState.gastos.filter(inCurrentMonth);
    const ingresosMes = NotaireState.ingresos.filter(inCurrentMonth);
    const totalGastos = sumAmounts(gastosMes);
    const totalIngresos = sumAmounts(ingresosMes);
    const presupuesto = Number(NotaireState.presupuestoTotal) || 0;
    const budgetPosition = window.NotaireFinancialChart
        ? window.NotaireFinancialChart.calculateBudgetPosition(presupuesto, totalGastos)
        : { hasBudget: presupuesto > 0, available: presupuesto - totalGastos, percentUsed: presupuesto > 0 ? (totalGastos / presupuesto) * 100 : null };

    setElemText('valGastadoEsteMes', formatCOP(totalGastos));
    setElemText('valPresupuestoTotal', budgetPosition.hasBudget ? formatCOP(presupuesto) : 'Sin presupuesto');
    setElemText('valPresupuestoPct', budgetPosition.hasBudget
        ? `${budgetPosition.percentUsed.toFixed(1)}% utilizado`
        : 'Sin presupuesto');
    setElemText('centerGastosTotal', formatCOP(totalGastos));

    const promedioIngresos = window.NotaireFinancialChart
        ? window.NotaireFinancialChart.averageMonthlyTotal(NotaireState.ingresos, 'ingreso')
        : totalIngresos / 6;
    const mayorIngreso = ingresosMes.reduce((largest, income) => Math.max(largest, Number(income.monto) || 0), 0);

    setElemText('valTotalIngresos', formatCOP(totalIngresos));
    setElemText('valPromedioMensual', formatCOP(promedioIngresos));
    setElemText('valMayorIngreso', formatCOP(mayorIngreso));
    setElemText('centerIngresosTotal', formatCOP(totalIngresos));

    // 3. Ahorros
    const totalAhorrado = NotaireState.metas.reduce((acc, curr) => acc + curr.actual, 0);
    const totalObjetivoMetas = NotaireState.metas.reduce((acc, curr) => acc + curr.objetivo, 0);
    const pctTotalMetas = totalObjetivoMetas > 0
        ? Math.min(100, Math.round((totalAhorrado / totalObjetivoMetas) * 100))
        : 0;

    setElemText('valTotalAhorrado', formatCOP(totalAhorrado));
    setElemText('valMetasActivasCount', NotaireState.metas.length);
    setElemText('valPorcentajeTotalMetas', `${pctTotalMetas}%`);

    // Refrescar listas dinámicas
    renderUltimosMovimientos();
    renderUltimosIngresos();
    renderGoalsGrid();
}

function formatCOP(monto) {
    return '$' + Math.round(monto).toLocaleString('es-CO');
}

function setElemText(id, text) {
    const el = document.getElementById(id);
    if (el) el.textContent = text;
}

/* ==========================================================================
   4. RENDERIZADO DINÁMICO DE COMPONENTES
   ========================================================================== */
function renderUltimosMovimientos() {
    const container = document.getElementById('listUltimosMovimientos');
    if (!container) return;

    container.innerHTML = NotaireState.gastos.slice(0, 4).map(g => `
        <div class="transaction-row">
            <div class="transaction-left">
                <div class="transaction-icon-box">${g.icono || '💳'}</div>
                <div class="transaction-info">
                    <span class="transaction-title">${escapeHtml(g.concepto)}</span>
                    <span class="transaction-date">${g.fecha || 'Hoy'}</span>
                </div>
            </div>
            <div style="display:flex; align-items:center; gap:8px;">
                <span class="transaction-amount-negative">-${formatCOP(g.monto)}</span>
                <div class="transaction-actions">
                    <button class="btn-tx-edit" title="Editar" onclick="openModalEditarGasto(${g.id})"><i class="fas fa-pen"></i></button>
                    <button class="btn-tx-delete" title="Eliminar" onclick="eliminarGasto(${g.id})"><i class="fas fa-trash"></i></button>
                </div>
            </div>
        </div>
    `).join('');
}

function renderUltimosIngresos() {
    const container = document.getElementById('listUltimosIngresos');
    if (!container) return;

    container.innerHTML = NotaireState.ingresos.slice(0, 4).map(i => `
        <div class="transaction-row">
            <div class="transaction-left">
                <div class="transaction-icon-box">${i.icono || '💰'}</div>
                <div class="transaction-info">
                    <span class="transaction-title">${escapeHtml(i.concepto)}</span>
                    <span class="transaction-date">${i.fecha || 'Hoy'}</span>
                </div>
            </div>
            <div style="display:flex; align-items:center; gap:8px;">
                <span class="transaction-amount-positive">+${formatCOP(i.monto)}</span>
                <div class="transaction-actions">
                    <button class="btn-tx-edit" title="Editar" onclick="openModalEditarIngreso(${i.id})"><i class="fas fa-pen"></i></button>
                    <button class="btn-tx-delete" title="Eliminar" onclick="eliminarIngreso(${i.id})"><i class="fas fa-trash"></i></button>
                </div>
            </div>
        </div>
    `).join('');
}

function renderGoalsGrid() {
    const container = document.getElementById('containerGoalsGrid');
    if (!container) return;

    const circumference = 169.64; // 2 * PI * 27

    container.innerHTML = NotaireState.metas.map(meta => {
        const pct = Math.min(100, Math.round((meta.actual / meta.objetivo) * 100));
        const strokeOffset = (circumference - (pct / 100) * circumference).toFixed(1);
        const falta = Math.max(0, meta.objetivo - meta.actual);

        return `
            <div class="goal-card">
                <div class="goal-card-top">
                    <div class="goal-header-left">
                        <div class="goal-icon-circle">${meta.icono || '🎯'}</div>
                        <span class="goal-title-text">${escapeHtml(meta.nombre)}</span>
                    </div>
                    <div class="progress-ring-container">
                        <svg class="progress-ring-svg">
                            <circle class="progress-ring-bg" stroke-width="5" fill="transparent" r="27" cx="30" cy="30"/>
                            <circle class="progress-ring-fill" stroke-width="5" stroke="${meta.color || '#10b981'}" fill="transparent" r="27" cx="30" cy="30" style="stroke-dashoffset: ${strokeOffset};"/>
                        </svg>
                        <span class="progress-ring-text">${pct}%</span>
                    </div>
                </div>
                <div class="goal-amounts-row">${formatCOP(meta.actual)} / ${formatCOP(meta.objetivo)}</div>
                <div class="goal-details-list">
                    <span>Falta: ${formatCOP(falta)}</span>
                    <span>Fecha: ${meta.fecha || '2026'}</span>
                </div>
                <div style="display:flex; gap:8px; margin-top:12px;">
                    <button class="btn-aportar-goal" style="flex:1;" onclick="openModalAportarMeta(${meta.id}, '${escapeHtml(meta.nombre)}')">
                        <i class="fas fa-plus"></i> Aportar
                    </button>
                    <button class="btn-tx-edit" title="Editar meta" onclick="openModalEditarMeta(${meta.id})"><i class="fas fa-pen"></i></button>
                    <button class="btn-tx-delete" title="Eliminar meta" onclick="eliminarMeta(${meta.id})"><i class="fas fa-trash"></i></button>
                </div>
            </div>
        `;
    }).join('');
}

/* ==========================================================================
   5. MANEJO DE MODALES Y ACCIONES DE BOTONES
   ========================================================================== */

function openModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.classList.add('active');
    }
}

function closeModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.classList.remove('active');
    }
}

// 1. Botón: + Registrar gasto
function openModalRegistrarGasto() {
    const form = document.getElementById('formRegistrarGasto');
    if (form) form.reset();
    document.getElementById('gastoFecha').value = getTodayIso();
    openModal('modalRegistrarGasto');
}

function handleGuardarGasto(event) {
    event.preventDefault();
    const monto = parseFloat(document.getElementById('gastoMonto').value);
    const categoria = document.getElementById('gastoCategoria').value;
    const descripcion = document.getElementById('gastoDescripcion').value;

    const iconMap = {
        'Alimentación': '🍔',
        'Transporte': '🚌',
        'Entretenimiento': '🎮',
        'Servicios': '🏠',
        'Otros': '🛒'
    };

    const newGasto = {
        id: Date.now(),
        concepto: descripcion,
        categoria: categoria,
        icono: iconMap[categoria] || '💳',
        monto: monto,
        fecha: 'Hoy'
    };

    NotaireState.gastos.unshift(newGasto);
    updateAllMetrics();
    closeModal('modalRegistrarGasto');
    showToast('¡Gasto registrado con éxito!');
}

// 2. Botón: + Registrar ingreso
function openModalRegistrarIngreso() {
    const form = document.getElementById('formRegistrarIngreso');
    if (form) form.reset();
    document.getElementById('ingresoFecha').value = getTodayIso();
    openModal('modalRegistrarIngreso');
}

function handleGuardarIngreso(event) {
    event.preventDefault();
    const monto = parseFloat(document.getElementById('ingresoMonto').value);
    const categoria = document.getElementById('ingresoCategoria').value;
    const descripcion = document.getElementById('ingresoDescripcion').value;

    const iconMap = {
        'Salario': '💼',
        'Freelance': '💻',
        'Negocio': '🛍️',
        'Intereses': '💰',
        'Otros': '🟢'
    };

    const newIngreso = {
        id: Date.now(),
        concepto: descripcion,
        fuente: categoria,
        icono: iconMap[categoria] || '💰',
        monto: monto,
        fecha: 'Hoy'
    };

    NotaireState.ingresos.unshift(newIngreso);
    updateAllMetrics();
    closeModal('modalRegistrarIngreso');
    showToast('¡Ingreso registrado con éxito!');
}

// 3. Botón: + Nueva meta
function openModalNuevaMeta() {
    const form = document.getElementById('formNuevaMeta');
    if (form) form.reset();
    document.getElementById('metaFecha').value = getFutureIso(120);
    openModal('modalNuevaMeta');
}

function handleGuardarNuevaMeta(event) {
    event.preventDefault();
    const nombre = document.getElementById('metaNombre').value;
    const objetivo = parseFloat(document.getElementById('metaObjetivo').value);
    const inicial = parseFloat(document.getElementById('metaInicial').value || 0);
    const fecha = document.getElementById('metaFecha').value;
    const icono = document.getElementById('metaIcono').value;

    const colors = ['#10b981', '#3b82f6', '#f59e0b', '#8b5cf6', '#ec4899'];
    const chosenColor = colors[NotaireState.metas.length % colors.length];

    const newMeta = {
        id: Date.now(),
        nombre: nombre,
        icono: icono,
        actual: inicial,
        objetivo: objetivo,
        fecha: fecha,
        color: chosenColor
    };

    NotaireState.metas.push(newMeta);
    updateAllMetrics();
    closeModal('modalNuevaMeta');
    showToast('¡Meta de ahorro creada con éxito!');
}

// 4. Botón: + Aportar (en tarjetas de meta)
function openModalAportarMeta(metaId, metaNombre) {
    document.getElementById('aporteMetaId').value = metaId;
    document.getElementById('aporteMetaNombre').value = metaNombre;
    document.getElementById('aporteMonto').value = '';
    openModal('modalAportarMeta');
}

function handleGuardarAporteMeta(event) {
    event.preventDefault();
    const metaId = parseInt(document.getElementById('aporteMetaId').value);
    const montoAporte = parseFloat(document.getElementById('aporteMonto').value);

    const meta = NotaireState.metas.find(m => m.id === metaId);
    if (meta) {
        meta.actual += montoAporte;
        
        // Agregar a ahorros recientes
        NotaireState.ahorrosRecientes.unshift({
            id: Date.now(),
            meta: meta.nombre,
            monto: montoAporte,
            fecha: 'Hoy',
            icono: '💚'
        });

        updateAllMetrics();
        closeModal('modalAportarMeta');
        showToast(`¡Aporte de ${formatCOP(montoAporte)} registrado a ${meta.nombre}!`);
    }
}

// 5. Botón: Ver perfil (Sidebar Samuel Gañán)
function openModalPerfil() {
    document.getElementById('perfilNombre').value = NotaireState.user.nombre;
    document.getElementById('perfilEmail').value = NotaireState.user.email;
    document.getElementById('perfilTelefono').value = NotaireState.user.telefono;
    document.getElementById('perfilDocumento').value = NotaireState.user.documento;
    openModal('modalPerfil');
}

function handleGuardarPerfil(event) {
    event.preventDefault();
    NotaireState.user.nombre = document.getElementById('perfilNombre').value;
    NotaireState.user.email = document.getElementById('perfilEmail').value;
    NotaireState.user.telefono = document.getElementById('perfilTelefono').value;
    NotaireState.user.documento = document.getElementById('perfilDocumento').value;

    const initials = NotaireState.user.nombre.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
    NotaireState.user.iniciales = initials;

    setElemText('sidebarUserName', NotaireState.user.nombre);
    const avatarCircle = document.getElementById('sidebarAvatarCircle');
    if (avatarCircle) avatarCircle.textContent = initials;

    closeModal('modalPerfil');
    showToast('¡Perfil actualizado correctamente!');
}

// 6. Botones: Ver todos (Movimientos / Ingresos / Cuentas)
function openModalVerTodos(tipo) {
    const titleEl = document.getElementById('verTodosTitle');
    const container = document.getElementById('verTodosContentList');
    if (!container) return;

    if (tipo === 'movimientos') {
        titleEl.textContent = 'Historial Completo de Movimientos';
        container.innerHTML = NotaireState.gastos.map(g => `
            <div class="transaction-row">
                <div class="transaction-left">
                    <div class="transaction-icon-box">${g.icono}</div>
                    <div class="transaction-info">
                        <span class="transaction-title">${escapeHtml(g.concepto)}</span>
                        <span class="transaction-date">${escapeHtml(g.categoria)} &bull; ${escapeHtml(g.fecha)}</span>
                    </div>
                </div>
                <span class="transaction-amount-negative">-${formatCOP(g.monto)}</span>
            </div>
        `).join('');
    } else if (tipo === 'ingresos') {
        titleEl.textContent = 'Historial Completo de Ingresos';
        container.innerHTML = NotaireState.ingresos.map(i => `
            <div class="transaction-row">
                <div class="transaction-left">
                    <div class="transaction-icon-box">${i.icono}</div>
                    <div class="transaction-info">
                        <span class="transaction-title">${escapeHtml(i.concepto)}</span>
                        <span class="transaction-date">${i.fuente} &bull; ${i.fecha}</span>
                    </div>
                </div>
                <span class="transaction-amount-positive">+${formatCOP(i.monto)}</span>
            </div>
        `).join('');
    } else {
        titleEl.textContent = 'Cuentas vinculadas';
        container.innerHTML = '<p class="data-state data-state-empty">No hay cuentas vinculadas registradas.</p>';
    }

    openModal('modalVerTodos');
}

function filterVerTodos() {
    const q = document.getElementById('verTodosSearch').value.toLowerCase();
    const rows = document.querySelectorAll('#verTodosContentList .transaction-row');
    rows.forEach(row => {
        const text = row.textContent.toLowerCase();
        row.style.display = text.includes(q) ? 'flex' : 'none';
    });
}

function openModalCuentas() {
    openModalVerTodos('cuentas');
}

/* ==========================================================================
   6. UTILIDADES Y TOAST NOTIFICATION
   ========================================================================== */
function showToast(msg) {
    const toast = document.getElementById('toastNotification');
    const msgEl = document.getElementById('toastMessage');
    if (!toast) return;

    if (msgEl) msgEl.textContent = msg;
    toast.classList.add('show');

    setTimeout(() => {
        toast.classList.remove('show');
    }, 3200);
}

function getTodayIso() {
    return new Date().toISOString().split('T')[0];
}

function getFutureIso(days) {
    const d = new Date();
    d.setDate(d.getDate() + days);
    return d.toISOString().split('T')[0];
}

function escapeHtml(str) {
    if (!str) return '';
    return str.replace(/[&<>"']/g, function(m) {
        return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[m];
    });
}

/* ==========================================================================
   7. FUNCIONES EDITAR / ELIMINAR MOVIMIENTOS
   ========================================================================== */

// --- GASTOS ---
function openModalEditarGasto(id) {
    const g = NotaireState.gastos.find(x => x.id === id);
    if (!g) return;
    document.getElementById('editGastoId').value = g.id;
    document.getElementById('editGastoMonto').value = g.monto;
    document.getElementById('editGastoCategoria').value = g.categoria;
    document.getElementById('editGastoDescripcion').value = g.concepto;
    document.getElementById('editGastoFecha').value = getTodayIso();
    openModal('modalEditarGasto');
}

function handleGuardarEdicionGasto(event) {
    event.preventDefault();
    const id = parseInt(document.getElementById('editGastoId').value);
    const g = NotaireState.gastos.find(x => x.id === id);
    if (!g) return;

    const iconMap = { 'Alimentación': '🍔', 'Transporte': '🚌', 'Entretenimiento': '🎮', 'Servicios': '🏠', 'Otros': '🛒' };
    g.monto = parseFloat(document.getElementById('editGastoMonto').value);
    g.categoria = document.getElementById('editGastoCategoria').value;
    g.concepto = document.getElementById('editGastoDescripcion').value;
    g.icono = iconMap[g.categoria] || '💳';

    updateAllMetrics();
    closeModal('modalEditarGasto');
    showToast('¡Gasto actualizado correctamente!');
}

function eliminarGasto(id) {
    if (!confirm('¿Eliminar este gasto?')) return;
    NotaireState.gastos = NotaireState.gastos.filter(x => x.id !== id);
    updateAllMetrics();
    showToast('Gasto eliminado.');
}

// --- INGRESOS ---
function openModalEditarIngreso(id) {
    const i = NotaireState.ingresos.find(x => x.id === id);
    if (!i) return;
    document.getElementById('editIngresoId').value = i.id;
    document.getElementById('editIngresoMonto').value = i.monto;
    document.getElementById('editIngresoFuente').value = i.fuente;
    document.getElementById('editIngresoDescripcion').value = i.concepto;
    document.getElementById('editIngresoFecha').value = getTodayIso();
    openModal('modalEditarIngreso');
}

function handleGuardarEdicionIngreso(event) {
    event.preventDefault();
    const id = parseInt(document.getElementById('editIngresoId').value);
    const i = NotaireState.ingresos.find(x => x.id === id);
    if (!i) return;

    const iconMap = { 'Salario': '💼', 'Freelance': '💻', 'Negocio': '🛍️', 'Intereses': '💰', 'Otros': '🟢' };
    i.monto = parseFloat(document.getElementById('editIngresoMonto').value);
    i.fuente = document.getElementById('editIngresoFuente').value;
    i.concepto = document.getElementById('editIngresoDescripcion').value;
    i.icono = iconMap[i.fuente] || '💰';

    updateAllMetrics();
    closeModal('modalEditarIngreso');
    showToast('¡Ingreso actualizado correctamente!');
}

function eliminarIngreso(id) {
    if (!confirm('¿Eliminar este ingreso?')) return;
    NotaireState.ingresos = NotaireState.ingresos.filter(x => x.id !== id);
    updateAllMetrics();
    showToast('Ingreso eliminado.');
}

// --- METAS / AHORROS ---
function openModalEditarMeta(id) {
    const m = NotaireState.metas.find(x => x.id === id);
    if (!m) return;
    document.getElementById('editMetaId').value = m.id;
    document.getElementById('editMetaNombre').value = m.nombre;
    document.getElementById('editMetaObjetivo').value = m.objetivo;
    document.getElementById('editMetaActual').value = m.actual;
    document.getElementById('editMetaFecha').value = m.fecha || getTodayIso();
    openModal('modalEditarMeta');
}

function handleGuardarEdicionMeta(event) {
    event.preventDefault();
    const id = parseInt(document.getElementById('editMetaId').value);
    const m = NotaireState.metas.find(x => x.id === id);
    if (!m) return;

    m.nombre = document.getElementById('editMetaNombre').value;
    m.objetivo = parseFloat(document.getElementById('editMetaObjetivo').value);
    m.actual = parseFloat(document.getElementById('editMetaActual').value);
    m.fecha = document.getElementById('editMetaFecha').value;

    updateAllMetrics();
    closeModal('modalEditarMeta');
    showToast('¡Meta actualizada correctamente!');
}

function eliminarMeta(id) {
    if (!confirm('¿Eliminar esta meta de ahorro?')) return;
    NotaireState.metas = NotaireState.metas.filter(x => x.id !== id);
    updateAllMetrics();
    showToast('Meta eliminada.');
}

/* Sidebar toggle (si no fue definido por un script previo) */
if (typeof toggleSidebar === 'undefined') {
    function toggleSidebar() {
        const sidebar = document.querySelector('.sidebar');
        if (!sidebar) return;
        const mobileTrigger = document.getElementById('mobileMenuTrigger');
        const backdrop = document.getElementById('mobileSidebarBackdrop');
        if (window.matchMedia('(max-width: 768px)').matches) {
            const open = sidebar.classList.toggle('mobile-open');
            backdrop?.classList.toggle('visible', open);
            document.body.classList.toggle('sidebar-mobile-open', open);
            mobileTrigger?.setAttribute('aria-expanded', String(open));
            return;
        }
        sidebar.classList.toggle('collapsed');
        localStorage.setItem('notaire_sidebar_collapsed', sidebar.classList.contains('collapsed') ? '1' : '0');
    }
}
