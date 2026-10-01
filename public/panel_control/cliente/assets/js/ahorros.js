async function cargarVistaAhorros() {
    try {
        const token = localStorage.getItem('notaire_token');
        if (!token) return;

        const headers = { Authorization: `Bearer ${token}` };
        const [resMetas, resAportes] = await Promise.all([
            fetch('/api/metas', { headers }),
            fetch('/api/metas/aportes', { headers }).catch(() => null)
        ]);

        if (!resMetas.ok) throw new Error('Error al obtener metas');

        const metasRespuesta = await resMetas.json();
        const aportesRespuesta = resAportes && resAportes.ok ? await resAportes.json() : [];
        const metas = Array.isArray(metasRespuesta) ? metasRespuesta : [];
        const aportes = Array.isArray(aportesRespuesta) ? aportesRespuesta : [];

        let totalAhorrado = 0;
        let sumaPorcentajes = 0;
        metas.forEach(meta => {
            const actual = Number.parseFloat(meta.monto_actual) || 0;
            const objetivo = Number.parseFloat(meta.monto_objetivo) || 1;
            totalAhorrado += actual;
            sumaPorcentajes += Math.min((actual / objetivo) * 100, 100);
        });

        const pctPromedio = metas.length > 0
            ? Math.round(sumaPorcentajes / metas.length)
            : 0;
        const moneda = valor => `$${valor.toLocaleString('es-CO')}`;

        const totalElement = document.getElementById('totalAhorrado');
        const metasElement = document.getElementById('metasActivas');
        const porcentajeElement = document.getElementById('porcentajeTotal');
        if (totalElement) totalElement.textContent = moneda(totalAhorrado);
        if (metasElement) metasElement.textContent = metas.length;
        if (porcentajeElement) porcentajeElement.textContent = `${pctPromedio}%`;

        const aportesList = document.getElementById('listaAhorrosRecientes');
        if (!aportesList) return;

        aportesList.innerHTML = '<p class="data-state data-state-loading">Cargando aportes...</p>';

        if (aportes.length === 0) {
            aportesList.innerHTML = '<p class="data-state data-state-empty">No hay aportes registrados aún.</p>';
            return;
        }

        aportesList.innerHTML = aportes.slice(0, 3).map(aporte => {
            const fecha = aporte.fecha ? new Date(aporte.fecha).toLocaleDateString('es-CO') : 'Sin fecha';
            const monto = Number.parseFloat(aporte.monto) || 0;
            const nombreMeta = aporte.meta_nombre || 'Aporte a Meta';
            return `
                <div class="transaction-row">
                    <div class="transaction-left">
                        <div class="transaction-icon-box" style="background: rgba(16, 185, 129, 0.15);">&#128154;</div>
                        <div class="transaction-info">
                            <span class="transaction-title">${escaparTextoAhorros(nombreMeta)}</span>
                            <span class="transaction-date">${escaparTextoAhorros(fecha)}</span>
                        </div>
                    </div>
                    <span class="transaction-amount-positive">+${moneda(monto)}</span>
                </div>
            `;
        }).join('');
    } catch (error) {
        console.error('Error actualizando la vista de Ahorros:', error);
        const aportesList = document.getElementById('listaAhorrosRecientes');
        if (aportesList) aportesList.innerHTML = '<p class="data-state data-state-error">No se pudieron cargar los aportes.</p>';
    }
}

function escaparTextoAhorros(valor) {
    return String(valor ?? '').replace(/[&<>"']/g, caracter => ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;'
    }[caracter]));
}

document.addEventListener('DOMContentLoaded', cargarVistaAhorros);
