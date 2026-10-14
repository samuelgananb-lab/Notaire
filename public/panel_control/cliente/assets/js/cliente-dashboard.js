const NotaireState = {
    user: { nombre: 'Usuario', email: '', telefono: '', documento: '', iniciales: 'US' },
    gastos: [],
    ingresos: [],
    metas: [],
    ahorrosRecientes: [],
    presupuestoTotal: 0
};

let chartClienteIngresos = null;

sincronizarEstadoCliente();

document.addEventListener('DOMContentLoaded', () => {
    initNavigation();
    initSidebar();
    initThemeToggle();
    initGlobalSearch();
    initMovimientoModal();
    cargarResumenDashboard();
    cargarDatosFinancieros();
    cargarMetasYAhorros();
});

function sincronizarEstadoCliente() {
    const usuarioGuardado = localStorage.getItem('notaire_user');
    if (usuarioGuardado) {
        try {
            const usuario = JSON.parse(usuarioGuardado);
            NotaireState.user = {
                ...NotaireState.user,
                nombre: usuario.nombre || usuario.email?.split('@')[0] || 'Usuario',
                email: usuario.email || ''
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
    if (messageElement) messageElement.textContent = message;
    toast.classList.add('show');
    window.setTimeout(() => toast.classList.remove('show'), 3200);
}

function setDataState(container, message, type = 'empty') {
    if (!container) return;
    container.innerHTML = `<p class="data-state data-state-${type}">${escaparTextoCliente(message)}</p>`;
}

function setFormLoading(form, loading) {
    if (!form) return;
    form.querySelectorAll('button[type="submit"]').forEach(button => {
        button.disabled = loading;
        button.dataset.originalText ??= button.textContent;
        button.textContent = loading ? 'Guardando...' : button.dataset.originalText;
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
        if (field) field.value = value ?? '';
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
        monto_objetivo: Number(document.getElementById('editMetaObjetivo')?.value),
        monto_actual: Number(document.getElementById('editMetaActual')?.value),
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
    if (!window.confirm(`¿Eliminar la meta "${nombre}"?`)) return;
    const token = localStorage.getItem('notaire_token');
    if (!token) return;

    try {
        const response = await fetch(`/api/metas/${encodeURIComponent(id)}`, {
            method: 'DELETE',
            headers: { Authorization: `Bearer ${token}` }
        });
        const result = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(result.detalle || result.error || 'No se pudo eliminar la meta');
        await actualizarVistaCliente();
        showToast('Meta eliminada correctamente');
    } catch (error) {
        showToast(error.message);
    }
}

function openModalAportarMeta(metaId, metaNombre) {
    const id = document.getElementById('aporteMetaId');
    const name = document.getElementById('aporteMetaNombre');
    const amount = document.getElementById('aporteMonto');
    if (id) id.value = metaId;
    if (name) name.value = metaNombre;
    if (amount) amount.value = '';
    openModal('modalAportarMeta');
}

function openModalAbono(metaId, metaNombre) {
    openModalAportarMeta(metaId, metaNombre);
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
    const monto = Number(document.getElementById(montoId)?.value);
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
        closeModal(tipo === 'gasto' ? 'modalRegistrarGasto' : 'modalRegistrarIngreso');
        actualizarVistaCliente();
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
            body: JSON.stringify({ nombre, email, telefono })
        });
        const result = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(result.detalle || result.error || 'No se pudo actualizar el perfil');

        const usuario = { ...NotaireState.user, ...result.usuario, documento };
        NotaireState.user = usuario;
        localStorage.setItem('notaire_user', JSON.stringify(usuario));
        const iniciales = nombre.split(/\s+/).map(parte => parte[0]).join('').slice(0, 2).toUpperCase();
        document.getElementById('sidebarUserName')?.replaceChildren(document.createTextNode(nombre));
        document.getElementById('sidebarAvatarInitials')?.replaceChildren(document.createTextNode(iniciales));
        closeModal('modalPerfil');
        showToast('Perfil actualizado correctamente');
    } catch (error) {
        showToast(error.message);
    } finally {
        setFormLoading(form, false);
    }
}

async function openModalVerTodos(tipo) {
    const token = localStorage.getItem('notaire_token');
    const container = document.getElementById('verTodosContentList');
    const title = document.getElementById('verTodosTitle');
    if (!container || !token) return;
    const response = await fetch('/api/transacciones', { headers: { Authorization: `Bearer ${token}` } });
    const movimientos = response.ok ? await response.json() : [];
    const lista = movimientos.filter(item => tipo === 'ingresos' ? item.tipo === 'ingreso' : item.tipo === 'gasto');
    if (title) title.textContent = tipo === 'ingresos' ? 'Historial de ingresos' : 'Historial de gastos';
    container.innerHTML = lista.length ? lista.map(item => `
        <div class="transaction-row">
            <div class="transaction-left"><div class="transaction-icon-box">${item.tipo === 'ingreso' ? '💼' : '🧾'}</div>
            <div class="transaction-info"><span class="transaction-title">${escaparTextoCliente(item.descripcion || item.categoria)}</span><span class="transaction-date">${escaparTextoCliente(item.fecha || '')}</span></div></div>
            <span class="${item.tipo === 'ingreso' ? 'transaction-amount-positive' : 'transaction-amount-negative'}">${item.tipo === 'ingreso' ? '+' : '-'}${formatCOP(item.monto)}</span>
        </div>`).join('') : '<p class="no-data">No hay movimientos registrados.</p>';
    openModal('modalVerTodos');
}

function confirmLogout() {
    localStorage.removeItem('notaire_token');
    localStorage.removeItem('notaire_user');
    window.location.href = '../../auth/login.html';
}

function escaparTextoCliente(value) {
    return String(value ?? '').replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[character]));
}

function actualizarVistaCliente() {
    cargarResumenDashboard();
    cargarDatosFinancieros();
    cargarMetasYAhorros();
    if (typeof cargarVistaAhorros === 'function') cargarVistaAhorros();
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
}

function navigateTo(viewId) {
    document.querySelectorAll('.content-section').forEach(section => section.classList.remove('active'));
    document.querySelectorAll('#sidebarMenu li').forEach(item => item.classList.remove('active'));

    const targetSection = document.getElementById(viewId);
    if (targetSection) targetSection.classList.add('active');

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

    if (viewId === 'view-ingresos' && chartClienteIngresos) {
        window.setTimeout(() => chartClienteIngresos.resize(), 100);
    }
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

function initThemeToggle() {
    const themeBtn = document.getElementById('themeToggleBtn');
    if (!themeBtn) return;

    const currentTheme = localStorage.getItem('notaire_theme') || 'dark';
    document.documentElement.setAttribute('data-theme', currentTheme);
    updateThemeIcon(themeBtn, currentTheme);

    themeBtn.addEventListener('click', () => {
        const newTheme = document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
        document.documentElement.setAttribute('data-theme', newTheme);
        localStorage.setItem('notaire_theme', newTheme);
        updateThemeIcon(themeBtn, newTheme);
    });
}

function updateThemeIcon(button, theme) {
    const icon = button.querySelector('i');
    if (icon) icon.className = theme === 'dark' ? 'fas fa-sun' : 'fas fa-moon';
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
        monto_objetivo: Number(document.getElementById('metaObjetivo')?.value),
        monto_actual: Number(document.getElementById('metaInicial')?.value || 0),
        fecha_limite: document.getElementById('metaFecha')?.value,
        icono: document.getElementById('metaIcono')?.value || '🎯'
    };

    if (!payload.nombre || !Number.isFinite(payload.monto_objetivo) || payload.monto_objetivo <= 0) {
        showToast('Completa un nombre y un monto objetivo válido');
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

        closeModal('modalNuevaMeta');
        if (typeof cargarMetasYAhorros === 'function') await cargarMetasYAhorros();
        if (typeof cargarVistaAhorros === 'function') await cargarVistaAhorros();
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
    const monto = Number(document.getElementById('aporteMonto')?.value);
    if (!token || !metaId || !Number.isFinite(monto) || monto <= 0) return;

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
        if (!response.ok) throw new Error(result.error || 'No se pudo registrar el aporte');

        closeModal('modalAportarMeta');
        if (typeof cargarMetasYAhorros === 'function') await cargarMetasYAhorros();
        if (typeof cargarVistaAhorros === 'function') await cargarVistaAhorros();
        if (typeof cargarPanelInicio === 'function') await cargarPanelInicio();
        showToast('¡Aporte registrado con éxito!');
    } catch (error) {
        console.error('Error al registrar el aporte:', error);
        showToast(error.message || 'No se pudo registrar el aporte');
    }
}

function mostrarErrorAporte(info) {
    const box = document.getElementById('aporteError');
    if (!box) return showToast(info.error);
    box.textContent = '';
    const msg = document.createElement('p');
    msg.textContent = info.error;
    box.appendChild(msg);

    const actions = document.createElement('div');
    actions.className = 'aporte-error-actions';
    if (info.saldoDisponible > 0) {
        const abonar = document.createElement('button');
        abonar.type = 'button';
        abonar.textContent = `Abonar ${formatCOP(info.saldoDisponible)}`;
        abonar.onclick = () => {
            document.getElementById('aporteMonto').value = info.saldoDisponible;
            box.hidden = true;
        };
        actions.appendChild(abonar);
    }
    const ingreso = document.createElement('button');
    ingreso.type = 'button';
    ingreso.textContent = 'Registrar un ingreso';
    ingreso.onclick = () => {
        closeModal('modalAportarMeta');
        if (typeof openModalRegistrarIngreso === 'function') openModalRegistrarIngreso();
    };
    actions.appendChild(ingreso);
    box.appendChild(actions);
    box.hidden = false;
}

async function cargarResumenDashboard() {
    if (!localStorage.getItem('notaire_token')) {
        window.location.href = '/auth/login.html';
        return;
    }

    try {
        const data = await fetchDashboardMetrics();
        if (data) {
            renderMetrics(data);
        }
    } catch (error) {
        console.warn('Usando datos por defecto / Error de red al consultar la API.', error);
    }
}

async function cargarDatosFinancieros() {
    const token = localStorage.getItem('notaire_token');
    if (!token) return;

    try {
        setDataState(document.getElementById('listUltimosMovimientos'), 'Cargando gastos...', 'loading');
        setDataState(document.getElementById('listUltimosIngresos'), 'Cargando ingresos...', 'loading');
        setDataState(document.getElementById('listMayoresGastos'), 'Cargando categorías...', 'loading');
        const response = await fetch('/api/transacciones', {
            headers: { Authorization: `Bearer ${token}` }
        });
        if (!response.ok) throw new Error('Error al obtener transacciones');
        const respuesta = await response.json();
        const transacciones = Array.isArray(respuesta) ? respuesta : [];
        const canvasIngresos = document.getElementById('chartEvolucionIngresos');
        if (canvasIngresos && typeof Chart !== 'undefined' && window.NotaireFinancialChart) {
            const serieIngresos = window.NotaireFinancialChart.createMonthlyTotals(transacciones);
            chartClienteIngresos?.destroy();
            chartClienteIngresos = new Chart(
                canvasIngresos.getContext('2d'),
                window.NotaireFinancialChart.createConfig(serieIngresos.labels, serieIngresos.values, formatCOP, 'Ingresos')
            );
        } else if (canvasIngresos) {
            console.error('No se pudo inicializar la gráfica de ingresos: faltan Chart.js o NotaireFinancialChart.');
        }
        const ahora = new Date();
        const delMes = transacciones.filter(item => {
            const fecha = new Date(item.fecha);
            return !Number.isNaN(fecha.getTime()) && fecha.getMonth() === ahora.getMonth() && fecha.getFullYear() === ahora.getFullYear();
        });
        const gastos = delMes.filter(item => (item.tipo || item.tipo_registro) === 'gasto');
        const ingresos = delMes.filter(item => (item.tipo || item.tipo_registro) === 'ingreso');
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
        actualizar('valPromedioMensual', formatCOP(totalIngresos));
        const presupuesto = Number(localStorage.getItem('notaire_presupuesto') || 0);
        actualizar('valPresupuestoTotal', formatCOP(presupuesto));
        actualizar('valDisponibleGastos', formatCOP(Math.max(presupuesto - totalGastos, 0)));
        const presupuestoPct = presupuesto > 0 ? Math.min(100, Math.round((totalGastos / presupuesto) * 100)) : 0;
        actualizar('valPresupuestoPct', `${presupuestoPct}% utilizado`);
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
            <span class="transaction-date">${escaparTextoCliente(item.fecha || '')} · ${escaparTextoCliente(item.categoria || '')}</span></div></div>
            <span class="${sonIngresos ? 'transaction-amount-positive' : 'transaction-amount-negative'}">${sonIngresos ? '+' : '-'}${formatCOP(item.monto)}</span>
        </div>`).join('') : '<p class="data-state data-state-empty">No hay registros este mes.</p>';
}

function renderGastosPorCategoria(gastos, totalGastos) {
    const container = document.getElementById('listMayoresGastos');
    if (!container) return;
    const categorias = {};
    gastos.forEach(item => {
        const categoria = item.categoria || 'Otros';
        categorias[categoria] = (categorias[categoria] || 0) + Number(item.monto || 0);
    });
    const lista = Object.entries(categorias).sort((a, b) => b[1] - a[1]).slice(0, 5);
    container.innerHTML = lista.length ? lista.map(([categoria, monto]) => {
        const porcentaje = totalGastos ? Math.round((monto / totalGastos) * 100) : 0;
        return `<div class="category-progress-item"><div class="category-info-row"><span class="category-name-icon">${escaparTextoCliente(categoria)}</span><div class="category-amount-pct"><span class="category-amount">${formatCOP(monto)}</span><span class="category-pct">${porcentaje}%</span></div></div><div class="progress-track-bg"><div class="progress-fill-bar" style="width: ${porcentaje}%; background: #10b981;"></div></div></div>`;
    }).join('') : '<p class="data-state data-state-empty">No hay gastos registrados este mes.</p>';
}

function renderLeyenda(containerId, transacciones, tipo) {
    const container = document.getElementById(containerId);
    if (!container) return;
    const total = transacciones.reduce((sum, item) => sum + Number(item.monto || 0), 0);
    const grupos = {};
    transacciones.forEach(item => {
        const clave = item.categoria || 'Otros';
        grupos[clave] = (grupos[clave] || 0) + Number(item.monto || 0);
    });
    const colores = ['#f59e0b', '#8b5cf6', '#06b6d4', '#10b981', '#3b82f6'];
    const lista = Object.entries(grupos).sort((a, b) => b[1] - a[1]);
    container.innerHTML = lista.length ? lista.map(([nombre, monto], index) => {
        const porcentaje = total ? Math.round((monto / total) * 100) : 0;
        return `<div class="legend-item"><span class="legend-dot" style="background: ${colores[index % colores.length]};"></span> ${escaparTextoCliente(nombre)} ${porcentaje}%</div>`;
    }).join('') : '<span class="data-state data-state-empty">Sin registros este mes.</span>';
}

const loadDashboardData = cargarResumenDashboard;

function renderMetrics(data) {
    if (data.patrimonio !== undefined) {
        const patrimonio = formatCurrency(data.patrimonio);
        const heroBalance = document.querySelector('.hero-balance-amount');
        const patrimonioMetric = document.getElementById('valPatrimonioNeto');
        if (heroBalance) heroBalance.textContent = patrimonio;
        if (patrimonioMetric) patrimonioMetric.textContent = patrimonio;
    }
    if (data.gastosMes !== undefined) {
        const gastos = document.getElementById('valGastadoEsteMes');
        if (gastos) gastos.textContent = formatCurrency(data.gastosMes);
    }
    if (data.ingresosMes !== undefined) {
        const ingresos = document.getElementById('valTotalIngresos');
        if (ingresos) ingresos.textContent = formatCurrency(data.ingresosMes);
    }
}

function formatCurrency(amount) {
    return new Intl.NumberFormat('es-CO', {
        style: 'currency',
        currency: 'COP',
        maximumFractionDigits: 0
    }).format(Number(amount) || 0);
}
