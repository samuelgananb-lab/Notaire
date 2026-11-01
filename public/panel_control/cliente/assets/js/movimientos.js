let idEdicionActual = null;

const MOVIMIENTOS_API_URL = '/api/transacciones';

document.addEventListener('DOMContentLoaded', () => {
    configurarFormulario();
});

function cambiarSeccion(tipo) {
    const target = tipo === 'gasto' ? 'view-gastos' : 'view-ingresos';
    if (typeof navigateTo === 'function') navigateTo(target);
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
            if (document.querySelector('.content-section.active')?.id === (body.tipo === 'gasto' ? 'view-gastos' : 'view-ingresos')) {
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
        if ((activeView === 'view-gastos' || activeView === 'view-ingresos') && typeof cargarDatosFinancieros === 'function') {
            await cargarDatosFinancieros(activeView);
        }
    } catch (error) {
        console.error('Error al eliminar:', error);
    }
}
