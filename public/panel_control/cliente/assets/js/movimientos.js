let moduloActivo = 'gasto';
let idEdicionActual = null;
let transaccionesCargadas = [];

const MOVIMIENTOS_API_URL = '/api/transacciones';

document.addEventListener('DOMContentLoaded', () => {
    const btnGastos = document.querySelector('#sidebarMenu a[data-target="view-gastos"]');
    const btnIngresos = document.querySelector('#sidebarMenu a[data-target="view-ingresos"]');

    btnGastos?.addEventListener('click', () => cambiarSeccion('gasto'));
    btnIngresos?.addEventListener('click', () => cambiarSeccion('ingreso'));
    configurarFormulario();
});

function cambiarSeccion(tipo) {
    moduloActivo = tipo;
    document.querySelectorAll('.content-section').forEach(section => section.classList.remove('active'));
    document.querySelectorAll('#sidebarMenu li').forEach(item => item.classList.remove('active'));

    document.getElementById('seccion-detallada')?.classList.add('active');
    const target = tipo === 'gasto' ? 'view-gastos' : 'view-ingresos';
    document.querySelector(`#sidebarMenu a[data-target="${target}"]`)?.parentElement.classList.add('active');
    const headerTitle = document.getElementById('headerDynamicTitle');
    if (headerTitle) headerTitle.textContent = tipo === 'gasto' ? 'GASTOS' : 'INGRESOS';

    cargarTablaMovimientos(tipo);
}

async function cargarTablaMovimientos(tipo) {
    const token = localStorage.getItem('notaire_token');
    if (!token) return;

    try {
        const response = await fetch(MOVIMIENTOS_API_URL, {
            headers: { Authorization: `Bearer ${token}` }
        });
        if (!response.ok) throw new Error('Error al obtener transacciones');

        const datos = await response.json();
        transaccionesCargadas = datos.filter(item => (item.tipo || item.tipo_registro) === tipo);
        aplicarFiltros();
        const tbody = document.getElementById('tabla-detallada-body');
        const tituloSeccion = document.getElementById('titulo-seccion-detallada');

        if (tituloSeccion) {
            tituloSeccion.textContent = tipo === 'gasto' ? 'Listado de Gastos' : 'Listado de Ingresos';
        }

        if (!tbody) return;
    } catch (error) {
        console.error(`Error al cargar ${tipo}:`, error);
        const tbody = document.getElementById('tabla-detallada-body');
        if (tbody) {
            tbody.innerHTML = '<tr><td colspan="5" style="text-align:center; color:#fca5a5; padding:20px;">No se pudieron cargar los movimientos. Revisa tu sesión o intenta de nuevo.</td></tr>';
        }
        const totalElement = document.getElementById('total-seccion-detallada');
        if (totalElement) totalElement.textContent = '$0';
    }
}

function aplicarFiltros() {
    const texto = (document.getElementById('filtroTexto')?.value || '').toLowerCase().trim();
    const desde = document.getElementById('filtroFechaDesde')?.value || '';
    const hasta = document.getElementById('filtroFechaHasta')?.value || '';

    const filtrados = transaccionesCargadas.filter(item => {
        const categoria = String(item.categoria || '').toLowerCase();
        const descripcion = String(item.descripcion || '').toLowerCase();
        const fecha = item.fecha ? String(item.fecha).split('T')[0] : '';
        return (!texto || categoria.includes(texto) || descripcion.includes(texto))
            && (!desde || fecha >= desde)
            && (!hasta || fecha <= hasta);
    });

    renderizarTablaFiltrada(filtrados);
}

function renderizarTablaFiltrada(lista) {
    const tbody = document.getElementById('tabla-detallada-body');
    const totalElement = document.getElementById('total-seccion-detallada');
    if (!tbody) return;

    if (lista.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" style="text-align:center; color:#888; padding:20px;">No se encontraron resultados con los filtros aplicados.</td></tr>';
        if (totalElement) totalElement.textContent = '$0';
        return;
    }

    tbody.innerHTML = lista.map(item => {
        const id = item.id || item.id_registro;
        const itemJson = JSON.stringify({ ...item, id }).replace(/'/g, '&#39;').replace(/"/g, '&quot;');
        return `
            <tr style="border-bottom: 1px solid rgba(255,255,255,0.05);">
                <td style="padding: 12px; color: #aaa;">${item.fecha || 'N/A'}</td>
                <td style="padding: 12px; color: #fff; font-weight: 500;">${item.categoria || 'General'}</td>
                <td style="padding: 12px; color: #aaa;">${item.descripcion || '-'}</td>
                <td style="padding: 12px; font-weight: bold; color: ${moduloActivo === 'ingreso' ? '#22c55e' : '#ef4444'};">${formatCurrency(item.monto)}</td>
                <td style="padding: 12px; text-align: center; display: flex; gap: 8px; justify-content: center;">
                    <button type="button" onclick="abrirModalEdicion(${itemJson})" style="background: none; border: none; color: #3b82f6; cursor: pointer;" title="Editar">✏️</button>
                    <button type="button" onclick="eliminarMovimiento('${id}', '${moduloActivo}')" style="background: none; border: none; color: #ef4444; cursor: pointer;" title="Eliminar">🗑️</button>
                </td>
            </tr>
        `;
    }).join('');

    if (totalElement) {
        const total = lista.reduce((sum, item) => sum + Number(item.monto || 0), 0);
        totalElement.textContent = formatCurrency(total);
        totalElement.style.color = moduloActivo === 'ingreso' ? '#22c55e' : '#ef4444';
    }
}

function limpiarFiltros() {
    ['filtroTexto', 'filtroFechaDesde', 'filtroFechaHasta'].forEach(id => {
        const input = document.getElementById(id);
        if (input) input.value = '';
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
            monto: Number(document.getElementById('montoMovimiento')?.value || 0),
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

            form.reset();
            idEdicionActual = null;
            const tituloModal = document.querySelector('#modalMovimiento h3');
            if (tituloModal) tituloModal.textContent = 'Registrar Movimiento';
            document.getElementById('modalMovimiento')?.style.setProperty('display', 'none');

            if (typeof cargarTablaMovimientos === 'function') cargarTablaMovimientos(moduloActivo);
            if (typeof cargarResumenDashboard === 'function') cargarResumenDashboard();
            if (typeof cargarVistaSaldo === 'function') cargarVistaSaldo();
        } catch (error) {
            alert('Error: ' + error.message);
        }
    });
}

async function eliminarMovimiento(id, tipo) {
    if (!window.confirm('¿Estás seguro de eliminar este registro?')) return;
    const token = localStorage.getItem('notaire_token');
    if (!token) return;

    try {
        const response = await fetch(`${MOVIMIENTOS_API_URL}/${encodeURIComponent(id)}`, {
            method: 'DELETE',
            headers: { Authorization: `Bearer ${token}` }
        });
        if (!response.ok) throw new Error('Error al eliminar transacción');
        await cargarTablaMovimientos(tipo);
        if (typeof cargarResumenDashboard === 'function') await cargarResumenDashboard();
        if (typeof cargarUltimosMovimientos === 'function') await cargarUltimosMovimientos();
    } catch (error) {
        console.error('Error al eliminar:', error);
    }
}

