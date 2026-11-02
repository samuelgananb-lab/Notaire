let idEdicionActual = null;
let moduloActivo = 'gasto';
const transaccionesCargadas = { gasto: [], ingreso: [] };

const MOVIMIENTOS_API_URL = '/api/transacciones';

document.addEventListener('DOMContentLoaded', () => {
    configurarFormulario();
});

function cambiarSeccion(tipo) {
    moduloActivo = tipo;
    const target = tipo === 'gasto' ? 'view-gastos' : 'view-ingresos';
    if (typeof navigateTo === 'function') navigateTo(target);
    else void cargarTablaMovimientos(tipo);
}

function getFinancialHistoryPanel(tipo) {
    return document.querySelector(`.financial-history-panel[data-financial-type="${tipo}"]`);
}

async function cargarTablaMovimientos(tipo) {
    if (!Object.prototype.hasOwnProperty.call(transaccionesCargadas, tipo)) {
        throw new Error(`Tipo de movimiento no válido: ${tipo}`);
    }
    moduloActivo = tipo;
    const token = localStorage.getItem('notaire_token');
    if (!token) return;

    const panel = getFinancialHistoryPanel(tipo);
    const tbody = panel?.querySelector('.financial-history-body');
    const totalElement = panel?.querySelector('.financial-history-total');
    if (!tbody) return;
    tbody.innerHTML = '<tr class="financial-history-empty-row"><td colspan="5" class="financial-history-state">Cargando movimientos...</td></tr>';

    try {
        const monthKey = window.NotaireFinancialChart?.selectedMonthKey() ||
            window.NotaireFinancialChart?.currentMonthKey() || '';
        const response = await fetchTransacciones(monthKey || null);
        if (!Array.isArray(response)) throw new Error('La respuesta de movimientos no es válida');
        const tipoDeMovimiento = item => window.NotaireFinancialChart
            ? window.NotaireFinancialChart.getTransactionType(item)
            : String(item.tipo || item.tipo_registro || '').trim().toLowerCase();
        transaccionesCargadas[tipo] = response
            .filter(item => tipoDeMovimiento(item) === tipo)
            .filter(item => !monthKey || String(item.fecha || '').slice(0, 7) === monthKey)
            .sort((a, b) => String(b.fecha || '').localeCompare(String(a.fecha || '')) || Number(b.id) - Number(a.id));
        aplicarFiltros(tipo);
    } catch (error) {
        console.error(`Error al cargar ${tipo}:`, error);
        tbody.innerHTML = '<tr class="financial-history-empty-row"><td colspan="5" class="financial-history-state financial-history-error">No se pudieron cargar los movimientos. Intenta de nuevo.</td></tr>';
        if (totalElement) totalElement.textContent = formatCOP(0);
    } finally {
        window.translateStaticContent?.(window.getCurrentLang?.() || 'es');
    }
}

function aplicarFiltros(tipo = moduloActivo) {
    const panel = getFinancialHistoryPanel(tipo);
    if (!panel) return;
    const search = (panel.querySelector('[data-history-filter="search"]')?.value || '').trim().toLocaleLowerCase();
    const from = panel.querySelector('[data-history-filter="from"]')?.value || '';
    const to = panel.querySelector('[data-history-filter="to"]')?.value || '';
    const filtered = transaccionesCargadas[tipo].filter(item => {
        const category = String(item.categoria || '').toLocaleLowerCase();
        const description = String(item.descripcion || '').toLocaleLowerCase();
        const date = String(item.fecha || '').slice(0, 10);
        return (!search || category.includes(search) || description.includes(search))
            && (!from || date >= from)
            && (!to || date <= to);
    });
    renderizarTablaFiltrada(filtered, tipo);
}

function renderizarTablaFiltrada(transacciones, tipo) {
    const panel = getFinancialHistoryPanel(tipo);
    const tbody = panel?.querySelector('.financial-history-body');
    const totalElement = panel?.querySelector('.financial-history-total');
    if (!tbody) return;
    if (transacciones.length === 0) {
        tbody.innerHTML = '<tr class="financial-history-empty-row"><td colspan="5" class="financial-history-state">No se encontraron registros con esos filtros.</td></tr>';
        if (totalElement) totalElement.textContent = formatCOP(0);
        return;
    }

    const escHtml = escaparTextoCliente;
    tbody.innerHTML = transacciones.map(item => {
        const id = item.id || item.id_registro;
        const itemJson = escHtml(JSON.stringify({ ...item, id }));
        return `
            <tr data-transaction="${itemJson}">
                <td class="financial-history-date">${escHtml(String(item.fecha || '').slice(0, 10) || '—')}</td>
                <td class="financial-history-category" data-user-content="true">${escHtml(item.categoria || 'General')}</td>
                <td class="financial-history-description" data-user-content="true">${escHtml(item.descripcion || '—')}</td>
                <td class="financial-history-amount ${tipo === 'ingreso' ? 'is-income' : 'is-expense'}">${escHtml(formatCOP(item.monto))}</td>
                <td class="financial-history-actions">
                    <button type="button" class="btn-tx-edit" aria-label="Editar ${tipo}" title="Editar" onclick="abrirModalEdicion(JSON.parse(this.closest('tr').dataset.transaction))"><i class="fas fa-pen"></i></button>
                    <button type="button" class="btn-tx-delete" aria-label="Eliminar ${tipo}" title="Eliminar" data-id="${escHtml(id)}" data-type="${tipo}" onclick="eliminarMovimiento(this.dataset.id, this.dataset.type)"><i class="fas fa-trash"></i></button>
                </td>
            </tr>`;
    }).join('');

    const total = transacciones.reduce((sum, item) => sum + (Number(item.monto) || 0), 0);
    if (totalElement) totalElement.textContent = formatCOP(total);
}

function limpiarFiltros(tipo = moduloActivo) {
    const panel = getFinancialHistoryPanel(tipo);
    panel?.querySelectorAll('[data-history-filter]').forEach(input => {
        input.value = '';
    });
    aplicarFiltros(tipo);
}

function abrirModalEdicion(item) {
    idEdicionActual = item.id || item.id_registro;
    document.getElementById('tipoMovimiento').value = item.tipo || item.tipo_registro;
    document.getElementById('montoMovimiento').value = item.monto;
    document.getElementById('categoriaMovimiento').value = item.categoria || '';
    document.getElementById('descripcionMovimiento').value = item.descripcion || '';
    document.getElementById('fechaMovimiento').value = String(item.fecha || '').slice(0, 10);

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
        const fechaInput = document.getElementById('fechaMovimiento');

        const body = {
            tipo: document.getElementById('tipoMovimiento')?.value || 'ingreso',
            monto: parseFormattedAmount(document.getElementById('montoMovimiento')?.value || 0),
            categoria: document.getElementById('categoriaMovimiento')?.value || 'General',
            descripcion: document.getElementById('descripcionMovimiento')?.value || '',
            fecha: fechaInput?.value
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
            const activeView = document.querySelector('.content-section.active')?.id;
            if (activeView === 'view-gastos' || activeView === 'view-ingresos') {
                if (typeof cargarDatosFinancieros === 'function') await cargarDatosFinancieros(activeView);
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
        if ((activeView === 'view-gastos' || activeView === 'view-ingresos') && typeof cargarDatosFinancieros === 'function') {
            await cargarDatosFinancieros(activeView);
        }
    } catch (error) {
        console.error('Error al eliminar:', error);
    }
}
