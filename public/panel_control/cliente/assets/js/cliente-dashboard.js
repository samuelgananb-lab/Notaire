const NotaireState = {
    user: { nombre: 'Usuario', email: '', telefono: '', documento: '', iniciales: 'US' },
    gastos: [],
    ingresos: [],
    metas: [],
    ahorrosRecientes: [],
    presupuestoTotal: 0
};

let chartClienteIngresos = null;
let dashboardMetricsCache = null;
let dashboardMetricsPromise = null;
let dashboardMetricsPromiseKey = null;
let dashboardMetricsRequestId = 0;
const DASHBOARD_METRICS_CACHE_TTL_MS = 5 * 60 * 1000;

function getDashboardMetrics() {
    const cacheKey = window.NotaireFinancialChart?.monthQuery() || '';
    if (dashboardMetricsCache?.key === cacheKey && dashboardMetricsCache.expiresAt > Date.now()) {
        return Promise.resolve(dashboardMetricsCache.value);
    }
    if (dashboardMetricsPromise && dashboardMetricsPromiseKey === cacheKey) return dashboardMetricsPromise;
    const requestId = dashboardMetricsRequestId;
    const request = fetchDashboardMetrics()
        .then(data => {
            if (requestId === dashboardMetricsRequestId) {
                dashboardMetricsCache = { key: cacheKey, value: data, expiresAt: Date.now() + DASHBOARD_METRICS_CACHE_TTL_MS };
            }
            return data;
        })
        .finally(() => {
            if (dashboardMetricsPromise === request) {
                dashboardMetricsPromise = null;
                dashboardMetricsPromiseKey = null;
            }
        });
    dashboardMetricsPromise = request;
    dashboardMetricsPromiseKey = cacheKey;
    return request;
}

function invalidateDashboardMetricsCache() {
    dashboardMetricsCache = null;
    dashboardMetricsPromise = null;
    dashboardMetricsPromiseKey = null;
    dashboardMetricsRequestId += 1;
}

sincronizarEstadoCliente();

document.addEventListener('DOMContentLoaded', () => {
    initNavigation();
    initSidebar();
    initGlobalSearch();
    initMovimientoModal();
    cargarResumenDashboard();
});

document.addEventListener('notaire:languagechange', () => {
    if (chartClienteIngresos) cargarDatosFinancieros();
});

function sincronizarEstadoCliente() {
    const usuarioGuardado = localStorage.getItem('notaire_user');
    if (usuarioGuardado) {
        try {
            const usuario = JSON.parse(usuarioGuardado);
            NotaireState.user = {
                ...NotaireState.user,
                nombre: usuario.nombre || usuario.email?.split('@')[0] || 'Usuario',
                email: usuario.email || '',
                telefono: usuario.telefono || '',
                documento: usuario.documento || ''
            };
        } catch (error) {
            console.error('Error al sincronizar el estado de usuario:', error);
        }
    }

    NotaireState.gastos = [];
    NotaireState.ingresos = [];
    NotaireState.metas = [];
    NotaireState.ahorrosRecientes = [];
}

function openModal(modalId) {
    document.getElementById(modalId)?.classList.add('active');
}

function closeModal(modalId) {
    document.getElementById(modalId)?.classList.remove('active');
}

function showToast(message) {
    const toast = document.getElementById('toastNotification');
    const messageElement = document.getElementById('toastMessage');
    if (!toast) return;
    if (messageElement) messageElement.textContent = window.translateText?.(message) || message;
    toast.classList.add('show');
    window.setTimeout(() => toast.classList.remove('show'), 3200);
}

function setDataState(container, message, type = 'empty') {
    if (!container) return;
    container.innerHTML = `<p class="data-state data-state-${type}">${escaparTextoCliente(window.translateText?.(message) || message)}</p>`;
}

function setFormLoading(form, loading) {
    if (!form) return;
    form.querySelectorAll('button[type="submit"]').forEach(button => {
        button.disabled = loading;
        button.dataset.originalText ??= button.textContent;
        const text = loading ? 'Guardando...' : button.dataset.originalText;
        button.textContent = window.translateText?.(text) || text;
    });
}

function getTodayIso() {
    return new Date().toISOString().split('T')[0];
}

function getFutureIso(days) {
    const date = new Date();
    date.setDate(date.getDate() + days);
    return date.toISOString().split('T')[0];
}

function formatCOP(value) {
    return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(Number(value) || 0);
}

function openModalRegistrarGasto() {
    document.getElementById('formRegistrarGasto')?.reset();
    const date = document.getElementById('gastoFecha');
    if (date) date.value = getTodayIso();
    openModal('modalRegistrarGasto');
}

function openModalRegistrarIngreso() {
    document.getElementById('formRegistrarIngreso')?.reset();
    const date = document.getElementById('ingresoFecha');
    if (date) date.value = getTodayIso();
    openModal('modalRegistrarIngreso');
}

function openModalNuevaMeta() {
    document.getElementById('formNuevaMeta')?.reset();
    const date = document.getElementById('metaFecha');
    if (date) date.value = getFutureIso(120);
    openModal('modalNuevaMeta');
}

function openModalEditarMeta(id, nombre, objetivo, actual, fecha) {
    const values = {
        editMetaId: id,
        editMetaNombre: nombre,
        editMetaObjetivo: objetivo,
        editMetaActual: actual,
        editMetaFecha: fecha
    };
    Object.entries(values).forEach(([fieldId, value]) => {
        const field = document.getElementById(fieldId);
        if (field) {
            field.value = value ?? '';
            window.formatAmountInput?.(field);
        }
    });
    openModal('modalEditarMeta');
}

async function handleGuardarEdicionMeta(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const token = localStorage.getItem('notaire_token');
    const id = document.getElementById('editMetaId')?.value;
    const payload = {
        nombre: document.getElementById('editMetaNombre')?.value.trim(),
        monto_objetivo: parseFormattedAmount(document.getElementById('editMetaObjetivo')?.value),
        monto_actual: parseFormattedAmount(document.getElementById('editMetaActual')?.value),
        fecha_limite: document.getElementById('editMetaFecha')?.value
    };
    if (!token || !id || !payload.nombre || !Number.isFinite(payload.monto_objetivo) || payload.monto_objetivo <= 0 || !Number.isFinite(payload.monto_actual) || payload.monto_actual < 0) {
        showToast('Completa los datos de la meta correctamente');
        return;
    }

    setFormLoading(form, true);
    try {
        const response = await fetch(`/api/metas/${encodeURIComponent(id)}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
            body: JSON.stringify(payload)
        });
        const result = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(result.detalle || result.error || 'No se pudo actualizar la meta');
        invalidateApiCache();
        closeModal('modalEditarMeta');
        await actualizarVistaCliente();
        showToast('Meta actualizada correctamente');
    } catch (error) {
        showToast(error.message);
    } finally {
        setFormLoading(form, false);
    }
}

async function eliminarMetaReal(id, nombre) {
    if (!await window.notaireConfirm(`¿Eliminar la meta "${nombre}"?`, { title: 'Eliminar meta', confirmText: 'Eliminar' })) return;
    const token = localStorage.getItem('notaire_token');
    if (!token) return;

    try {
        const response = await fetch(`/api/metas/${encodeURIComponent(id)}`, {
            method: 'DELETE',
            headers: { Authorization: `Bearer ${token}` }
        });
        const result = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(result.detalle || result.error || 'No se pudo eliminar la meta');
        invalidateApiCache();
        await actualizarVistaCliente();
        showToast('Meta eliminada correctamente');
    } catch (error) {
        showToast(error.message);
    }
}

function openModalAportarMeta(metaId, metaNombre, objetivo = 0, actual = 0) {
    const id = document.getElementById('aporteMetaId');
    const name = document.getElementById('aporteMetaNombre');
    const amount = document.getElementById('aporteMonto');
    if (id) id.value = metaId;
    if (name) name.value = metaNombre;
    if (amount) amount.value = '';
    const remaining = Math.max(0, Number(objetivo) - Number(actual));
    const objetivoInput = document.getElementById('aporteMetaObjetivo');
    const actualInput = document.getElementById('aporteMetaActual');
    const remainingLabel = document.getElementById('aporteDisponible');
    if (objetivoInput) objetivoInput.value = String(Number(objetivo) || 0);
    if (actualInput) actualInput.value = String(Number(actual) || 0);
    if (amount) {
        amount.max = String(remaining);
        amount.disabled = remaining <= 0;
    }
    if (remainingLabel) {
        const english = window.getCurrentLang?.() === 'en';
        remainingLabel.textContent = remaining > 0
            ? `${english ? 'Remaining to reach the goal: ' : 'Máximo disponible para completar la meta: '}${formatCOP(remaining)}`
            : (english ? 'This goal is already complete.' : 'Esta meta ya alcanzó su monto objetivo.');
    }
    const submit = document.querySelector('#modalAportarMeta button[type="submit"]');
    if (submit) submit.disabled = remaining <= 0;
    const errorBox = document.getElementById('aporteError');
    if (errorBox) {
        errorBox.hidden = true;
        errorBox.textContent = '';
    }
    openModal('modalAportarMeta');
}

function openModalAbono(metaId, metaNombre, objetivo, actual) {
    openModalAportarMeta(metaId, metaNombre, objetivo, actual);
}

function openModalPerfil() {
    const user = NotaireState.user;
    const fields = {
        perfilNombre: user.nombre,
        perfilEmail: user.email,
        perfilTelefono: user.telefono,
        perfilDocumento: user.documento
    };
    Object.entries(fields).forEach(([id, value]) => {
        const element = document.getElementById(id);
        if (element) element.value = value || '';
    });
    openModal('modalPerfil');
}

async function handleGuardarGasto(event) {
    await guardarTransaccion(event, 'gasto', 'gastoMonto', 'gastoCategoria', 'gastoDescripcion', 'gastoFecha');
}

async function handleGuardarIngreso(event) {
    await guardarTransaccion(event, 'ingreso', 'ingresoMonto', 'ingresoCategoria', 'ingresoDescripcion', 'ingresoFecha');
}

async function guardarTransaccion(event, tipo, montoId, categoriaId, descripcionId, fechaId) {
    event.preventDefault();
    const token = localStorage.getItem('notaire_token');
    const monto = parseFormattedAmount(document.getElementById(montoId)?.value);
    const categoria = document.getElementById(categoriaId)?.value;
    const descripcion = document.getElementById(descripcionId)?.value.trim();
    const fecha = document.getElementById(fechaId)?.value;
    if (!token || !Number.isFinite(monto) || monto <= 0 || !categoria || !descripcion) {
        showToast('Completa todos los campos con valores válidos');
        return;
    }
    const form = event.currentTarget;
    setFormLoading(form, true);

    try {
        const response = await fetch('/api/transacciones', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
            body: JSON.stringify({ tipo, monto, categoria, descripcion, fecha })
        });
        const result = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(result.detalle || result.error || 'No se pudo guardar el movimiento');
        invalidateApiCache();
        closeModal(tipo === 'gasto' ? 'modalRegistrarGasto' : 'modalRegistrarIngreso');
        await actualizarVistaCliente();
        showToast('Movimiento guardado correctamente');
    } catch (error) {
        showToast(error.message);
    } finally {
        setFormLoading(form, false);
    }
}

async function handleGuardarPerfil(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const token = localStorage.getItem('notaire_token');
    const nombre = document.getElementById('perfilNombre')?.value.trim() || 'Usuario';
    const email = document.getElementById('perfilEmail')?.value.trim() || '';
    const telefono = document.getElementById('perfilTelefono')?.value.trim() || '';
    const documento = document.getElementById('perfilDocumento')?.value.trim() || '';
    if (!token || !nombre || !email) {
        showToast('Nombre y correo son obligatorios');
        return;
    }

    setFormLoading(form, true);
    try {
        const response = await fetch('/api/auth/me', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
            body: JSON.stringify({ nombre, email, telefono, documento })
        });
        const result = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(result.detalle || result.error || 'No se pudo actualizar el perfil');

        const usuario = { ...NotaireState.user, ...result.usuario, documento };
        NotaireState.user = usuario;
        localStorage.setItem('notaire_user', JSON.stringify(usuario));
        const iniciales = nombre.split(/\s+/).map(parte => parte[0]).join('').slice(0, 2).toUpperCase();
        document.getElementById('sidebarUserName')?.replaceChildren(document.createTextNode(nombre));
        document.getElementById('sidebarAvatarInitials')?.replaceChildren(document.createTextNode(iniciales));
        const configNombre = document.getElementById('configNombre');
        const configEmail = document.getElementById('configEmail');
        const configTelefono = document.getElementById('configTelefono');
        if (configNombre) configNombre.textContent = nombre;
        if (configEmail) configEmail.textContent = email || (window.translateText?.('Sin correo') || 'Sin correo');
        if (configTelefono) configTelefono.textContent = telefono || (window.translateText?.('Sin teléfono') || 'Sin teléfono');
        closeModal('modalPerfil');
        showToast('Perfil actualizado correctamente');
    } catch (error) {
        showToast(error.message);
    } finally {
        setFormLoading(form, false);
    }
}

function confirmLogout() {
    localStorage.removeItem('notaire_token');
    localStorage.removeItem('notaire_user');
    sessionStorage.removeItem('notaire_cliente_active_view');
    window.location.href = '../../auth/login.html';
}

function escaparTextoCliente(value) {
    return String(value ?? '').replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[character]));
}

async function actualizarVistaCliente() {
    const actualizaciones = [
        cargarResumenDashboard(),
        cargarDatosFinancieros()
    ];
    if (typeof cargarVistaMetasAhorros === 'function') {
        actualizaciones.push(cargarVistaMetasAhorros());
    }
    if (typeof cargarPanelInicio === 'function') {
        actualizaciones.push(cargarPanelInicio());
    }
    await Promise.all(actualizaciones);
}

function updateAllMetrics() {
    actualizarVistaCliente();
}

function initNavigation() {
    const navLinks = document.querySelectorAll('#sidebarMenu a[data-target]');

    navLinks.forEach(link => {
        link.addEventListener('click', event => {
            event.preventDefault();
            navigateTo(link.getAttribute('data-target'));
        });
    });

    const savedView = sessionStorage.getItem('notaire_cliente_active_view');
    const validSavedView = Array.from(navLinks).some(link => link.getAttribute('data-target') === savedView);
    navigateTo(validSavedView ? savedView : 'view-inicio');
}

function navigateTo(viewId) {
    const targetSection = document.getElementById(viewId);
    if (!targetSection) return;

    document.querySelectorAll('.content-section').forEach(section => section.classList.remove('active'));
    document.querySelectorAll('#sidebarMenu li').forEach(item => item.classList.remove('active'));

    targetSection.classList.add('active');
    sessionStorage.setItem('notaire_cliente_active_view', viewId);

    const activeLink = document.querySelector(`#sidebarMenu a[data-target="${viewId}"]`);
    if (activeLink) activeLink.parentElement.classList.add('active');

    const headerTitle = document.getElementById('headerDynamicTitle');
    if (headerTitle && activeLink) {
        const text = activeLink.querySelector('span')?.textContent || 'PANEL PRINCIPAL';
        headerTitle.textContent = text.toUpperCase();
    }

    if (viewId === 'view-ingresos' && chartClienteIngresos) {
        window.setTimeout(() => chartClienteIngresos.resize(), 100);
    }
    if (viewId === 'view-gastos' || viewId === 'view-ingresos') {
        void cargarDatosFinancieros(viewId);
    }
    if (viewId === 'view-saldo') {
        const saldoSection = document.getElementById('seccion-saldo');
        if (saldoSection) saldoSection.style.display = 'block';
        void cargarVistaSaldo();
    }
    if (viewId === 'view-metas' && typeof cargarVistaMetasAhorros === 'function') {
        void cargarVistaMetasAhorros();
    }
    if (viewId === 'view-recordatorios' && typeof renderCalendar === 'function') renderCalendar();
    if (viewId === 'view-configuracion' && typeof refreshConfigDisplay === 'function') refreshConfigDisplay();
    if (viewId === 'view-inicio' && typeof cargarPanelInicio === 'function') void cargarPanelInicio();
}

function initSidebar() {
    const toggleBtn = document.getElementById('sidebarToggleBtn');
    const mobileTrigger = document.getElementById('mobileMenuTrigger');
    const sidebar = document.querySelector('.sidebar');
    const backdrop = document.getElementById('mobileSidebarBackdrop');

    if (toggleBtn && sidebar) {
        const sidebarCollapsed = localStorage.getItem('notaire_sidebar_collapsed') === '1';
        sidebar.classList.toggle('collapsed', sidebarCollapsed);
        toggleBtn.setAttribute('aria-expanded', String(!sidebarCollapsed));
        toggleBtn.title = sidebarCollapsed ? 'Expandir menú' : 'Colapsar menú';
        toggleBtn.addEventListener('click', toggleSidebar);
        mobileTrigger?.addEventListener('click', toggleSidebar);
        backdrop?.addEventListener('click', closeMobileSidebar);
        document.querySelectorAll('#sidebarMenu a[data-target]').forEach(link => {
            link.addEventListener('click', closeMobileSidebar);
        });
    }
}

function toggleSidebar() {
    const sidebar = document.querySelector('.sidebar');
    const toggleBtn = document.getElementById('sidebarToggleBtn');
    if (!sidebar) return;

    if (window.matchMedia('(max-width: 768px)').matches) {
        const open = sidebar.classList.toggle('mobile-open');
        document.getElementById('mobileSidebarBackdrop')?.classList.toggle('visible', open);
        document.body.classList.toggle('sidebar-mobile-open', open);
        if (toggleBtn) {
            toggleBtn.setAttribute('aria-expanded', String(open));
            toggleBtn.title = open ? 'Cerrar menú' : 'Abrir menú';
        }
        document.getElementById('mobileMenuTrigger')?.setAttribute('aria-expanded', String(open));
        return;
    }

    const collapsed = sidebar.classList.toggle('collapsed');
    localStorage.setItem('notaire_sidebar_collapsed', collapsed ? '1' : '0');
    if (toggleBtn) {
        toggleBtn.setAttribute('aria-expanded', String(!collapsed));
        toggleBtn.title = collapsed ? 'Expandir menú' : 'Colapsar menú';
    }
}

function closeMobileSidebar() {
    const sidebar = document.querySelector('.sidebar');
    const toggleBtn = document.getElementById('sidebarToggleBtn');
    sidebar?.classList.remove('mobile-open');
    document.getElementById('mobileSidebarBackdrop')?.classList.remove('visible');
    document.body.classList.remove('sidebar-mobile-open');
    if (toggleBtn && window.matchMedia('(max-width: 768px)').matches) {
        toggleBtn.setAttribute('aria-expanded', 'false');
        toggleBtn.title = 'Abrir menú';
    }
    document.getElementById('mobileMenuTrigger')?.setAttribute('aria-expanded', 'false');
}

function initGlobalSearch() {
    const searchInput = document.getElementById('globalSearchInput');
    if (!searchInput) return;

    searchInput.addEventListener('input', event => {
        const query = event.target.value.toLowerCase().trim();
        document.querySelectorAll('.transaction-row').forEach(row => {
            row.style.display = row.textContent.toLowerCase().includes(query) ? 'flex' : 'none';
        });
    });
}

function initMovimientoModal() {
    const modal = document.getElementById('modalMovimiento');
    const form = document.getElementById('formMovimiento');
    const openButton = document.getElementById('btnAbrirMovimiento');
    const closeButton = document.getElementById('btnCerrarModal');

    if (!modal || !form) return;

    openButton?.addEventListener('click', () => {
        modal.style.display = 'flex';
    });

    closeButton?.addEventListener('click', () => {
        modal.style.display = 'none';
    });

    modal.addEventListener('click', event => {
        if (event.target === modal) modal.style.display = 'none';
    });

}

async function handleGuardarNuevaMeta(event) {
    event.preventDefault();
    const token = localStorage.getItem('notaire_token');
    if (!token) return;

    const payload = {
        nombre: document.getElementById('metaNombre')?.value.trim(),
        monto_objetivo: parseFormattedAmount(document.getElementById('metaObjetivo')?.value),
        monto_actual: parseFormattedAmount(document.getElementById('metaInicial')?.value || 0),
        fecha_limite: document.getElementById('metaFecha')?.value,
        icono: document.getElementById('metaIcono')?.value || '🎯'
    };

    if (!payload.nombre || !Number.isFinite(payload.monto_objetivo) || payload.monto_objetivo <= 0) {
        showToast('Completa un nombre y un monto objetivo válido');
        return;
    }
    if (!Number.isFinite(payload.monto_actual) || payload.monto_actual < 0 || payload.monto_actual > payload.monto_objetivo) {
        showToast('El ahorro inicial no puede superar el monto objetivo de la meta.');
        return;
    }

    try {
        const response = await fetch('/api/metas', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
            body: JSON.stringify(payload)
        });
        const resultado = await response.json().catch(() => ({}));
        if (!response.ok) {
            throw new Error(resultado.detalle || resultado.error || 'No se pudo crear la meta');
        }

        invalidateApiCache();
        closeModal('modalNuevaMeta');
        if (typeof cargarVistaMetasAhorros === 'function') await cargarVistaMetasAhorros();
        if (typeof cargarPanelInicio === 'function') await cargarPanelInicio();
        showToast('¡Meta de ahorro creada con éxito!');
    } catch (error) {
        console.error('Error al crear la meta:', error);
        showToast(error.message);
    }
}

async function handleGuardarAporteMeta(event) {
    event.preventDefault();
    const token = localStorage.getItem('notaire_token');
    const metaId = document.getElementById('aporteMetaId')?.value;
    const monto = parseFormattedAmount(document.getElementById('aporteMonto')?.value);
    if (!token || !metaId || !Number.isFinite(monto) || monto <= 0) return;
    const objetivo = Number(document.getElementById('aporteMetaObjetivo')?.value || 0);
    const actual = Number(document.getElementById('aporteMetaActual')?.value || 0);
    const restante = Math.max(0, objetivo - actual);
    if (monto > restante) {
        mostrarErrorAporte({
            codigo: 'META_LIMITE',
            montoMaximo: restante,
            error: restante > 0
                ? `Solo puedes aportar ${formatCOP(restante)} para completar esta meta.`
                : 'Esta meta ya alcanzó su monto objetivo.'
        });
        return;
    }

    try {
        const response = await fetch('/api/metas/aportar', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
            body: JSON.stringify({ meta_id: metaId, monto })
        });
        const result = await response.json().catch(() => ({}));
        if (response.status === 422 && result.codigo === 'SALDO_INSUFICIENTE') {
            mostrarErrorAporte(result);
            return;
        }
        if (response.status === 422 && result.codigo === 'META_LIMITE') {
            mostrarErrorAporte(result);
            return;
        }
        if (!response.ok) throw new Error(result.error || 'No se pudo registrar el aporte');

        invalidateApiCache();
        closeModal('modalAportarMeta');
        if (typeof cargarVistaMetasAhorros === 'function') await cargarVistaMetasAhorros();
        if (typeof cargarPanelInicio === 'function') await cargarPanelInicio();
        showToast('¡Aporte registrado con éxito!');
    } catch (error) {
        console.error('Error al registrar el aporte:', error);
        showToast(error.message || 'No se pudo registrar el aporte');
    }
}

function mostrarErrorAporte(info) {
    const box = document.getElementById('aporteError');
    const english = window.getCurrentLang?.() === 'en';
    const message = typeof info?.error === 'string' && info.error.trim()
        ? info.error
        : (english ? 'The contribution could not be completed.' : 'No se pudo completar el aporte.');
    if (!box) return showToast(message);
    box.textContent = message;
    box.hidden = false;
}

async function cargarResumenDashboard() {
    if (!localStorage.getItem('notaire_token')) {
        window.location.href = '/auth/login.html';
        return;
    }

    try {
        const data = await getDashboardMetrics();
        if (data) {
            renderMetrics(data);
        }
    } catch (error) {
        console.warn('Usando datos por defecto / Error de red al consultar la API.', error);
    }
}

async function cargarDatosFinancieros(viewId = document.querySelector('.content-section.active')?.id) {
    const token = localStorage.getItem('notaire_token');
    if (!token) return;

    try {
        setDataState(document.getElementById('listUltimosMovimientos'), 'Cargando gastos...', 'loading');
        setDataState(document.getElementById('listUltimosIngresos'), 'Cargando ingresos...', 'loading');
        setDataState(document.getElementById('listMayoresGastos'), 'Cargando categorías...', 'loading');
        const monthKey = window.NotaireFinancialChart?.currentMonthKey();
        const [dashboardData, transactionsResponse] = await Promise.all([
            getDashboardMetrics(),
            fetchTransacciones(monthKey)
        ]);
        const transacciones = Array.isArray(transactionsResponse) ? transactionsResponse : [];
        const canvasIngresos = document.getElementById('chartEvolucionIngresos');
        if (canvasIngresos && typeof Chart !== 'undefined' && window.NotaireFinancialChart &&
            (viewId === 'view-ingresos' || chartClienteIngresos)) {
            const serieIngresos = window.NotaireFinancialChart.createMonthlyTotals([], 'ingreso');
            serieIngresos.values = (dashboardData.ingresosMensuales || []).map(item => Number(item.total) || 0);
            if (chartClienteIngresos) {
                chartClienteIngresos.data.labels = serieIngresos.labels;
                chartClienteIngresos.data.datasets[0].data = serieIngresos.values;
                chartClienteIngresos.update('none');
            } else {
                chartClienteIngresos = new Chart(
                    canvasIngresos.getContext('2d'),
                    window.NotaireFinancialChart.createConfig(
                        serieIngresos.labels,
                        serieIngresos.values,
                        formatCOP,
                        window.translateText?.('Ingresos') || 'Ingresos'
                    )
                )
            }
        } else if (canvasIngresos && (typeof Chart === 'undefined' || !window.NotaireFinancialChart)) {
            console.error('No se pudo inicializar la gráfica de ingresos: faltan Chart.js o NotaireFinancialChart.');
        }
        const tipoMovimiento = item => window.NotaireFinancialChart
            ? window.NotaireFinancialChart.getTransactionType(item)
            : String(item.tipo || item.tipo_registro || '').toLowerCase();
        const gastos = transacciones.filter(item => tipoMovimiento(item) === 'gasto');
        const ingresos = transacciones.filter(item => tipoMovimiento(item) === 'ingreso');
        const totalGastos = gastos.reduce((total, item) => total + Number(item.monto || 0), 0);
        const totalIngresos = ingresos.reduce((total, item) => total + Number(item.monto || 0), 0);
        const mayorIngreso = ingresos.reduce((mayor, item) => Math.max(mayor, Number(item.monto || 0)), 0);
        const actualizar = (id, value) => {
            const element = document.getElementById(id);
            if (element) element.textContent = value;
        };
        actualizar('valGastadoEsteMes', formatCOP(totalGastos));
        actualizar('centerGastosTotal', formatCOP(totalGastos));
        actualizar('valTotalIngresos', formatCOP(totalIngresos));
        actualizar('centerIngresosTotal', formatCOP(totalIngresos));
        actualizar('valMayorIngreso', formatCOP(mayorIngreso));
        const promedioMensual = (dashboardData.ingresosMensuales || [])
            .reduce((total, item) => total + (Number(item.total) || 0), 0) /
            ((dashboardData.ingresosMensuales || []).length || 1);
        actualizar('valPromedioMensual', formatCOP(promedioMensual));
        const presupuesto = Number(localStorage.getItem('notaire_presupuesto') || 0);
        const presupuestoMensual = window.NotaireFinancialChart
            ? window.NotaireFinancialChart.calculateBudgetPosition(presupuesto, totalGastos)
            : { hasBudget: presupuesto > 0, available: presupuesto - totalGastos, percentUsed: presupuesto > 0 ? (totalGastos / presupuesto) * 100 : null };
        actualizar('valPresupuestoTotal', presupuestoMensual.hasBudget ? formatCOP(presupuesto) : 'Sin presupuesto');
        actualizar('valPresupuestoPct', presupuestoMensual.hasBudget ? `${Math.round(presupuestoMensual.percentUsed)}% utilizado` : 'Sin presupuesto');
        renderTransacciones('listUltimosMovimientos', gastos, false);
        renderTransacciones('listUltimosIngresos', ingresos, true);
        renderGastosPorCategoria(gastos, totalGastos);
        renderLeyenda('legendGastosCategorias', gastos, 'gasto');
        renderLeyenda('legendIngresosFuentes', ingresos, 'ingreso');
    } catch (error) {
        console.error('Error al cargar datos financieros:', error);
        setDataState(document.getElementById('listUltimosMovimientos'), 'No se pudieron cargar los gastos.', 'error');
        setDataState(document.getElementById('listUltimosIngresos'), 'No se pudieron cargar los ingresos.', 'error');
        setDataState(document.getElementById('listMayoresGastos'), 'No se pudieron cargar las categorías.', 'error');
        showToast('No se pudieron cargar los movimientos');
    } finally {
        window.translateStaticContent?.(window.getCurrentLang?.() || 'es');
    }
}

function renderTransacciones(containerId, transacciones, sonIngresos) {
    const container = document.getElementById(containerId);
    if (!container) return;
    const lista = transacciones.slice(0, 5);
    container.innerHTML = lista.length ? lista.map(item => `
        <div class="transaction-row">
            <div class="transaction-left"><div class="transaction-icon-box">${sonIngresos ? '💼' : '🧾'}</div>
            <div class="transaction-info"><span class="transaction-title">${escaparTextoCliente(item.descripcion || item.categoria || 'Movimiento')}</span>
            <span class="transaction-date" data-user-content="true">${escaparTextoCliente(item.fecha || '')} · ${escaparTextoCliente(item.categoria || '')}</span></div></div>
            <span class="${sonIngresos ? 'transaction-amount-positive' : 'transaction-amount-negative'}">${sonIngresos ? '+' : '-'}${formatCOP(item.monto)}</span>
        </div>`).join('') : '<p class="data-state data-state-empty">No hay registros este mes.</p>';
}

function renderGastosPorCategoria(gastos, totalGastos) {
    const container = document.getElementById('listMayoresGastos');
    if (!container) return;
    const colorTema = getComputedStyle(document.documentElement).getPropertyValue('--color-primary').trim();
    const categorias = {};
    gastos.forEach(item => {
        const categoria = item.categoria || 'Otros';
        categorias[categoria] = (categorias[categoria] || 0) + Number(item.monto || 0);
    });
    const lista = Object.entries(categorias).sort((a, b) => b[1] - a[1]).slice(0, 5);
    container.innerHTML = lista.length ? lista.map(([categoria, monto]) => {
        const porcentaje = totalGastos ? Math.round((monto / totalGastos) * 100) : 0;
        return `<div class="category-progress-item"><div class="category-info-row"><span class="category-name-icon" data-user-content="true">${escaparTextoCliente(categoria)}</span><div class="category-amount-pct"><span class="category-amount">${formatCOP(monto)}</span><span class="category-pct">${porcentaje}%</span></div></div><div class="progress-track-bg"><div class="progress-fill-bar" style="width: ${porcentaje}%; background: ${colorTema};"></div></div></div>`;
    }).join('') : '<p class="data-state data-state-empty">No hay gastos registrados este mes.</p>';
}

function renderLeyenda(containerId, transacciones, tipo) {
    const container = document.getElementById(containerId);
    if (!container) return;
    const movimientos = transacciones.filter(item => (
        String(item.tipo || item.tipo_registro || '').toLowerCase() === tipo
    ));
    const total = movimientos.reduce((sum, item) => sum + Number(item.monto || 0), 0);
    const grupos = {};
    movimientos.forEach(item => {
        const clave = item.categoria || 'Otros';
        grupos[clave] = (grupos[clave] || 0) + Number(item.monto || 0);
    });
    const styles = getComputedStyle(document.documentElement);
    const colores = [
        styles.getPropertyValue('--color-accent-orange').trim(),
        styles.getPropertyValue('--color-primary').trim(),
        styles.getPropertyValue('--color-primary-hover').trim(),
        styles.getPropertyValue('--color-secondary').trim(),
        styles.getPropertyValue('--color-secondary-light').trim()
    ];
    const lista = Object.entries(grupos).sort((a, b) => b[1] - a[1]);
    container.innerHTML = lista.length ? lista.map(([nombre, monto], index) => {
        const porcentaje = total ? Math.round((monto / total) * 100) : 0;
        return `<div class="legend-item"><span class="legend-dot" style="background: ${colores[index % colores.length]};"></span> <span data-user-content="true">${escaparTextoCliente(nombre)}</span> ${porcentaje}%</div>`;
    }).join('') : '<span class="data-state data-state-empty">Sin registros este mes.</span>';
}

const loadDashboardData = cargarResumenDashboard;

function renderMetrics(data) {
    if (data.liquidez !== undefined) {
        const patrimonio = formatCurrency(data.liquidez);
        const heroBalance = document.querySelector('.hero-balance-amount');
        const patrimonioMetric = document.getElementById('valPatrimonioNeto');
        if (heroBalance) heroBalance.textContent = patrimonio;
        if (patrimonioMetric) patrimonioMetric.textContent = patrimonio;
        const disponibleGastos = document.getElementById('valDisponibleGastos');
        if (disponibleGastos) disponibleGastos.textContent = patrimonio;
    }
    if (data.gastosMes !== undefined) {
        const gastos = document.getElementById('valGastadoEsteMes');
        if (gastos) gastos.textContent = formatCurrency(data.gastosMes);
    }
    if (data.ingresosMes !== undefined) {
        const ingresos = document.getElementById('valTotalIngresos');
        if (ingresos) ingresos.textContent = formatCurrency(data.ingresosMes);
    }
    if (data.movimientoTotal !== undefined) {
        const mov = document.getElementById('valMovimientoTotal');
        if (mov) mov.textContent = formatCurrency(data.movimientoTotal);
    }
}

function formatCurrency(amount) {
    return new Intl.NumberFormat('es-CO', {
        style: 'currency',
        currency: 'COP',
        maximumFractionDigits: 0
    }).format(Number(amount) || 0);
}
