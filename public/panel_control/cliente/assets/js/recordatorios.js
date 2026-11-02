const RECORDATORIOS_API_URL = '/api/recordatorios';

document.addEventListener('DOMContentLoaded', () => {
    const calendarioLink = document.querySelector('#sidebarMenu a[data-target="view-recordatorios"]');
    calendarioLink?.addEventListener('click', () => cargarRecordatorios());
    document.getElementById('calendarPaymentAdd')?.addEventListener('click', abrirModalRecordatorio);
    configurarFormularioRecordatorios();
    void cargarRecordatorios();
});

function abrirModalRecordatorio() {
    const form = document.getElementById('formRecordatorio');
    const modal = document.getElementById('modalRecordatorio');
    form?.reset();
    const dateInput = document.getElementById('fechaRecordatorio');
    if (dateInput) {
        const today = new Date();
        dateInput.value = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    }
    if (modal) modal.style.display = 'flex';
    document.getElementById('tituloRecordatorio')?.focus();
}

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
            container.innerHTML = '<div class="calendar-payments-empty">No tienes compromisos financieros programados.</div>';
            return;
        }

        container.innerHTML = lista.map(recordatorio => {
            const pagado = recordatorio.estado === 'pagado';
            const estado = pagado ? 'pendiente' : 'pagado';
            return `
                <article class="calendar-payment-row${pagado ? ' is-paid' : ''}">
                    <div class="calendar-payment-details">
                        <strong data-user-content="true">${escapeRecordatorio(recordatorio.titulo)}</strong>
                        <span>Vence: <time data-user-content="true">${escapeRecordatorio(recordatorio.fecha_vencimiento || 'N/A')}</time></span>
                    </div>
                    <strong class="calendar-payment-amount">${formatRecordatorioCurrency(recordatorio.monto)}</strong>
                    <button type="button" class="calendar-payment-status${pagado ? ' is-paid' : ''}" aria-label="${pagado ? 'Marcar como pendiente' : 'Marcar como pagado'}" onclick="cambiarEstadoRecordatorio('${recordatorio.id}', '${estado}')">${pagado ? 'Pagado' : 'Pendiente'}</button>
                    <button type="button" class="calendar-payment-delete" aria-label="Eliminar compromiso" title="Eliminar compromiso" onclick="eliminarRecordatorio('${recordatorio.id}')">
                        <i class="fas fa-trash" aria-hidden="true"></i>
                    </button>
                </article>
            `;
        }).join('');
    } catch (error) {
        console.error('Error al cargar recordatorios:', error);
        void window.notaireAlert(error.message, { title: 'No se pudieron cargar los compromisos' });
    } finally {
        window.translateStaticContent?.(window.getCurrentLang?.() || 'es');
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
                    monto: parseFormattedAmount(document.getElementById('montoRecordatorio').value),
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
            void window.notaireAlert(error.message, { title: 'No se pudo guardar el compromiso' });
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
        void window.notaireAlert(error.message, { title: 'No se pudo actualizar el compromiso' });
    }
}

async function eliminarRecordatorio(id) {
    if (!await window.notaireConfirm('¿Eliminar este compromiso financiero?', { title: 'Eliminar compromiso', confirmText: 'Eliminar' })) return;
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
        void window.notaireAlert(error.message, { title: 'No se pudo eliminar el compromiso' });
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
