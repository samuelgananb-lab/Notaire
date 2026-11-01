let moduloActivo = 'gasto';
let idEdicionActual = null;
let transaccionesCargadas = [];

const MOVIMIENTOS_API_URL = '/api/transacciones';

document.addEventListener('DOMContentLoaded', () => {
    configurarFormulario();
});

function cambiarSeccion(tipo) {
    moduloActivo = tipo;
    const target = tipo === 'gasto' ? 'view-gastos' : 'view-ingresos';
    if (typeof navigateTo === 'function') navigateTo(target);
    else cargarTablaMovimientos(tipo);
}

function getFinancialHistoryPanel(tipo = moduloActivo) {
    return document.querySelector(`.financial-history-panel[data-financial-type="${tipo}"]`);
}

async function cargarTablaMovimientos(tipo) {
    moduloActivo = tipo;
    const token = localStorage.getItem('notaire_token');
    if (!token) return;

    const panel = getFinancialHistoryPanel(tipo);
    const tbody = panel?.querySelector('.financial-history-body');
    const totalElement = panel?.querySelector('.financial-history-total');
    if (!tbody) return;

    try {
        const mesElegido = window.NotaireFinancialChart?.selectedMonthKey() ||
            window.NotaireFinancialChart?.currentMonthKey();
        const datos = await fetchTransacciones(mesElegido);
        transaccionesCargadas = datos.filter(item => String(item.tipo || item.tipo_registro || '').toLowerCase() === tipo
            && String(item.fecha || '').slice(0, 7) === mesElegido);
        aplicarFiltros(tipo);
    } catch (error) {
        console.error(`Error al cargar ${tipo}:`, error);
        tbody.innerHTML = '<tr><td colspan="5" style="text-align:center; color:#fca5a5; padding:20px;">No se pudieron cargar los movimientos. Revisa tu sesión o intenta de nuevo.</td></tr>';
        if (totalElement) totalElement.textContent = '$0';
    } finally {
        window.translateStaticContent?.(window.getCurrentLang?.() || 'es');
    }
}

function aplicarFiltros(tipo = moduloActivo) {
    const panel = getFinancialHistoryPanel(tipo);
    if (!panel) return;
    const texto = (panel.querySelector('[data-history-filter="search"]')?.value || '').toLowerCase().trim();
    const desde = panel.querySelector('[data-history-filter="from"]')?.value || '';
    const hasta = panel.querySelector('[data-history-filter="to"]')?.value || '';

    const filtrados = transaccionesCargadas.filter(item => {
        const categoria = String(item.categoria || '').toLowerCase();
        const descripcion = String(item.descripcion || '').toLowerCase();
        const fecha = item.fecha ? String(item.fecha).split('T')[0] : '';
        return (!texto || categoria.includes(texto) || descripcion.includes(texto))
            && (!desde || fecha >= desde)
            && (!hasta || fecha <= hasta);
    });

    renderizarTablaFiltrada(filtrados, tipo);
}

function renderizarTablaFiltrada(lista, tipo = moduloActivo) {
    const panel = getFinancialHistoryPanel(tipo);
    const tbody = panel?.querySelector('.financial-history-body');
    const totalElement = panel?.querySelector('.financial-history-total');
    if (!tbody) return;

    if (lista.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" style="text-align:center; color:#888; padding:20px;">No se encontraron resultados con los filtros aplicados.</td></tr>';
        if (totalElement) totalElement.textContent = '$0';
        return;
    }

    const escHtml = v => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    tbody.innerHTML = lista.map(item => {
        const id = item.id || item.id_registro;
        const itemJson = escHtml(JSON.stringify({ ...item, id }));
        return `
            <tr data-transaction="${itemJson}" style="border-bottom: 1px solid rgba(255,255,255,0.05);">
                <td style="padding: 12px; color: var(--color-text-muted);">${escHtml(item.fecha || 'N/A')}</td>
                <td data-user-content="true" style="padding: 12px; color: var(--color-text-main); font-weight: 500;">${escHtml(item.categoria || 'General')}</td>
                <td data-user-content="true" style="padding: 12px; color: var(--color-text-muted);">${escHtml(item.descripcion || '-')}</td>
                <td style="padding: 12px; font-weight: bold; color: ${tipo === 'ingreso' ? '#22c55e' : '#ef4444'};">${formatCurrency(item.monto)}</td>
                <td style="padding: 12px; text-align: center; display: flex; gap: 8px; justify-content: center;">
                    <button type="button" onclick="abrirModalEdicion(JSON.parse(this.closest('tr').dataset.transaction))" style="background: none; border: none; color: #3b82f6; cursor: pointer;" title="Editar">✏️</button>
                    <button type="button" data-id="${escHtml(id)}" data-type="${tipo}" onclick="eliminarMovimiento(this.dataset.id, this.dataset.type)" style="background: none; border: none; color: #ef4444; cursor: pointer;" title="Eliminar">🗑️</button>
                </td>
            </tr>
        `;
    }).join('');

    if (totalElement) {
        const total = lista.reduce((sum, item) => sum + Number(item.monto || 0), 0);
        totalElement.textContent = formatCurrency(total);
        totalElement.style.color = tipo === 'ingreso' ? '#22c55e' : '#ef4444';
    }
}

function limpiarFiltros() {
    const panel = getFinancialHistoryPanel();
    panel?.querySelectorAll('[data-history-filter]').forEach(input => {
        input.value = '';
    });
    aplicarFiltros();
}

function abrirModalEdicion(item) {
    idEdicionActual = item.id || item.id_registro;
    document.getElementById('tipoMovimiento').value = item.tipo || item.tipo_registro;
    document.getElementById('montoMovimiento').value = item.monto;
    document.getElementById('categoriaMovimiento').value = item.categoria || '';
    document.getElementById('descripcionMovimiento').value = item.descripcion || '';

    const tituloModal = document.querySelector('#modalMovimiento h3');
    if (tituloModal) tituloModal.textContent = 'Editar Movimiento';
    document.getElementById('modalMovimiento')?.style.setProperty('display', 'flex');
}

function configurarFormulario() {
    const form = document.getElementById('formMovimiento');
    if (!form) return;

    form.addEventListener('submit', async e => {
        e.preventDefault();
        const token = localStorage.getItem('notaire_token');

        const body = {
            tipo: document.getElementById('tipoMovimiento')?.value || 'ingreso',
            monto: parseFormattedAmount(document.getElementById('montoMovimiento')?.value || 0),
            categoria: document.getElementById('categoriaMovimiento')?.value || 'General',
            descripcion: document.getElementById('descripcionMovimiento')?.value || '',
            fecha: new Date().toISOString().split('T')[0]
        };

        const esEdicion = idEdicionActual !== null && idEdicionActual !== undefined;
        const url = esEdicion
            ? `${MOVIMIENTOS_API_URL}/${idEdicionActual}`
            : MOVIMIENTOS_API_URL;
        const method = esEdicion ? 'PUT' : 'POST';

        try {
            const res = await fetch(url, {
                method,
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`
                },
                body: JSON.stringify(body)
            });

            const data = await res.json();

            if (!res.ok) {
                throw new Error(data.detalle || data.error || 'Error al procesar la transacción');
            }

            invalidateApiCache();
            form.reset();
            idEdicionActual = null;
            const tituloModal = document.querySelector('#modalMovimiento h3');
            if (tituloModal) tituloModal.textContent = 'Registrar Movimiento';
            document.getElementById('modalMovimiento')?.style.setProperty('display', 'none');

            if (typeof cargarResumenDashboard === 'function') await cargarResumenDashboard();
            if (typeof cargarPanelInicio === 'function') await cargarPanelInicio();
            if (typeof cargarVistaSaldo === 'function') await cargarVistaSaldo();
            if (document.querySelector('.content-section.active')?.id === (body.tipo === 'gasto' ? 'view-gastos' : 'view-ingresos')) {
                await cargarTablaMovimientos(body.tipo);
                if (typeof cargarDatosFinancieros === 'function') await cargarDatosFinancieros();
            }
        } catch (error) {
            void window.notaireAlert(error.message, { title: 'No se pudo guardar el movimiento' });
        }
    });
}

async function eliminarMovimiento(id, tipo) {
    if (!await window.notaireConfirm('¿Estás seguro de eliminar este registro?', { title: 'Eliminar movimiento', confirmText: 'Eliminar' })) return;
    const token = localStorage.getItem('notaire_token');
    if (!token) return;

    try {
        const response = await fetch(`${MOVIMIENTOS_API_URL}/${encodeURIComponent(id)}`, {
            method: 'DELETE',
            headers: { Authorization: `Bearer ${token}` }
        });
        if (!response.ok) throw new Error('Error al eliminar transacción');
        invalidateApiCache();
        if (typeof cargarResumenDashboard === 'function') await cargarResumenDashboard();
        if (typeof cargarPanelInicio === 'function') await cargarPanelInicio();
        const activeView = document.querySelector('.content-section.active')?.id;
        const activeType = activeView === 'view-gastos' ? 'gasto' : activeView === 'view-ingresos' ? 'ingreso' : null;
        if (activeType) {
            if (typeof cargarDatosFinancieros === 'function') await cargarDatosFinancieros(activeView);
            await cargarTablaMovimientos(activeType);
        }
    } catch (error) {
        console.error('Error al eliminar:', error);
    }
}
