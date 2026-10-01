const RECORDATORIOS_API_URL = '/api/recordatorios';

document.addEventListener('DOMContentLoaded', () => {
    const calendarioLink = document.querySelector('#sidebarMenu a[data-target="view-recordatorios"]');
    calendarioLink?.addEventListener('click', () => cargarRecordatorios());
    configurarFormularioRecordatorios();
});

async function cargarRecordatorios() {
    const token = localStorage.getItem('notaire_token');
    if (!token) return;

    try {
        const response = await fetch(RECORDATORIOS_API_URL, {
            headers: { Authorization: `Bearer ${token}` }
        });
        if (!response.ok) throw new Error('Error al obtener recordatorios');

        const lista = await response.json();
        const container = document.getElementById('lista-recordatorios');
        if (!container) return;

        if (!Array.isArray(lista) || lista.length === 0) {
            container.innerHTML = '<p style="color:#888; text-align:center; padding:20px;">No tienes compromisos financieros programados.</p>';
            return;
        }

        container.innerHTML = lista.map(recordatorio => {
            const pagado = recordatorio.estado === 'pagado';
            const estado = pagado ? 'pendiente' : 'pagado';
            return `
                <div style="display:flex; justify-content:space-between; align-items:center; background:rgba(255,255,255,0.03); padding:14px 18px; border-radius:8px; border-left:4px solid ${pagado ? '#22c55e' : '#eab308'};">
                    <div>
                        <strong style="color:${pagado ? '#888' : '#fff'}; display:block; ${pagado ? 'text-decoration:line-through;' : ''}">${escapeRecordatorio(recordatorio.titulo)}</strong>
                        <small style="color:#aaa;">Vence: ${escapeRecordatorio(recordatorio.fecha_vencimiento || 'N/A')}</small>
                    </div>
                    <div style="display:flex; align-items:center; gap:10px;">
                        <span style="font-weight:bold; color:${pagado ? '#22c55e' : '#fff'};">${formatRecordatorioCurrency(recordatorio.monto)}</span>
                        <button type="button" onclick="cambiarEstadoRecordatorio('${recordatorio.id}', '${estado}')" style="background:${pagado ? '#22c55e22' : '#eab30822'}; color:${pagado ? '#22c55e' : '#eab308'}; border:1px solid currentColor; padding:4px 10px; border-radius:6px; cursor:pointer; font-size:.8em;">${pagado ? 'Pagado' : 'Pendiente'}</button>
                        <button type="button" onclick="eliminarRecordatorio('${recordatorio.id}')" style="background:none; border:none; color:#ef4444; cursor:pointer;">🗑️</button>
                    </div>
                </div>
            `;
        }).join('');
    } catch (error) {
        console.error('Error al cargar recordatorios:', error);
    }
}

function configurarFormularioRecordatorios() {
    const form = document.getElementById('formRecordatorio');
    if (!form) return;

    form.addEventListener('submit', async event => {
        event.preventDefault();
        const token = localStorage.getItem('notaire_token');
        if (!token) return;

        const fecha = document.getElementById('fechaRecordatorio').value;
        try {
            const response = await fetch(RECORDATORIOS_API_URL, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`
                },
                body: JSON.stringify({
                    titulo: document.getElementById('tituloRecordatorio').value,
                    monto: Number(document.getElementById('montoRecordatorio').value),
                    fecha_vencimiento: fecha
                })
            });

            const contentType = response.headers.get('content-type') || '';
            if (!contentType.includes('application/json')) {
                throw new Error(`El servidor respondió con código ${response.status}. Verifica que la ruta '/api/recordatorios' esté bien escrita en server.js`);
            }

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.detalle || data.error || 'Error al guardar recordatorio');
            }

            form.reset();
            document.getElementById('modalRecordatorio').style.display = 'none';
            await cargarRecordatorios();
        } catch (error) {
            window.alert(`Detalle del error: ${error.message}`);
        }
    });
}

async function cambiarEstadoRecordatorio(id, estado) {
    const token = localStorage.getItem('notaire_token');
    if (!token) return;

    try {
        const response = await fetch(`${RECORDATORIOS_API_URL}/${encodeURIComponent(id)}/estado`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${token}`
            },
            body: JSON.stringify({ estado })
        });
        if (!response.ok) throw new Error('Error al actualizar estado');
        await cargarRecordatorios();
    } catch (error) {
        console.error('Error al actualizar estado:', error);
    }
}

async function eliminarRecordatorio(id) {
    if (!window.confirm('¿Eliminar este compromiso financiero?')) return;
    const token = localStorage.getItem('notaire_token');
    if (!token) return;

    try {
        const response = await fetch(`${RECORDATORIOS_API_URL}/${encodeURIComponent(id)}`, {
            method: 'DELETE',
            headers: { Authorization: `Bearer ${token}` }
        });
        if (!response.ok) throw new Error('Error al eliminar recordatorio');
        await cargarRecordatorios();
    } catch (error) {
        console.error('Error al eliminar recordatorio:', error);
    }
}

function formatRecordatorioCurrency(amount) {
    return new Intl.NumberFormat('es-CO', {
        style: 'currency',
        currency: 'COP',
        minimumFractionDigits: 0
    }).format(Number(amount) || 0);
}

function escapeRecordatorio(value) {
    return String(value ?? '').replace(/[&<>"']/g, character => ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;'
    })[character]);
}
