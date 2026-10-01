async function cargarMetasYAhorros() {
    try {
        const token = localStorage.getItem('notaire_token');
        const res = await fetch('/api/metas', {
            headers: { Authorization: `Bearer ${token}` }
        });

        if (!res.ok) throw new Error('Error al cargar metas');
        const respuesta = await res.json();
        const metas = Array.isArray(respuesta) ? respuesta : [];

        const totalMetasActivas = metas.length;
        let totalAhorrado = 0;
        let sumaPorcentajes = 0;

        metas.forEach(meta => {
            const actual = Number.parseFloat(meta.monto_actual) || 0;
            const objetivo = Number.parseFloat(meta.monto_objetivo) || 1;
            totalAhorrado += actual;
            sumaPorcentajes += Math.min((actual / objetivo) * 100, 100);
        });

        const progresoPromedio = totalMetasActivas > 0
            ? Math.round(sumaPorcentajes / totalMetasActivas)
            : 0;
        const moneda = valor => `$${valor.toLocaleString('es-CO')}`;

        document.querySelectorAll('.total-ahorrado-val').forEach(el => {
            el.textContent = moneda(totalAhorrado);
        });
        document.querySelectorAll('.metas-activas-val').forEach(el => {
            el.textContent = totalMetasActivas;
        });
        document.querySelectorAll('.porcentaje-total-val').forEach(el => {
            el.textContent = `${progresoPromedio}%`;
        });

        ['totalAhorrado', 'valTotalAhorrado', 'valTotalAhorradoMetas'].forEach(id => {
            const el = document.getElementById(id);
            if (el) el.textContent = moneda(totalAhorrado);
        });
        ['metasActivas', 'valMetasActivasCount', 'valMetasCount'].forEach(id => {
            const el = document.getElementById(id);
            if (el) el.textContent = totalMetasActivas;
        });
        ['porcentajeTotal', 'valPorcentajeTotalMetas', 'valMetasAvgPct'].forEach(id => {
            const el = document.getElementById(id);
            if (el) el.textContent = `${progresoPromedio}%`;
        });

        document.querySelectorAll('.progress-fill-bar').forEach(el => {
            el.style.width = `${progresoPromedio}%`;
        });

        const contenedores = [
            document.getElementById('contenedorMetas'),
            document.getElementById('misMetasLista'),
            document.getElementById('containerGoalsGrid'),
            document.getElementById('metasGoalsGrid')
        ].filter(Boolean);
        const contenedoresUnicos = [...new Set(contenedores)];
        const estadoVacio = document.getElementById('metasEmptyState');
        if (estadoVacio) estadoVacio.style.display = metas.length === 0 ? 'flex' : 'none';

        contenedoresUnicos.forEach(contenedor => {
            if (metas.length === 0) {
                contenedor.innerHTML = '<p class="data-state data-state-empty">No tienes metas registradas aún.</p>';
                return;
            }

            contenedor.innerHTML = metas.map(meta => {
                const id = meta.id ?? meta.id_meta;
                const nombre = meta.nombre ?? meta.nombre_meta ?? 'Meta';
                const actual = Number.parseFloat(meta.monto_actual) || 0;
                const objetivo = Number.parseFloat(meta.monto_objetivo) || 1;
                const porcentaje = Math.min(Math.round((actual / objetivo) * 100), 100);
                const falta = Math.max(objetivo - actual, 0);
                const nombreSeguro = String(nombre).replace(/\\/g, '\\\\').replace(/'/g, "\\'");
                const nombreHtml = String(nombre).replace(/[&<>\"]/g, caracter => ({
                    '&': '&amp;',
                    '<': '&lt;',
                    '>': '&gt;',
                    '\"': '&quot;'
                }[caracter]));

                const circumference = 169.64;
                const strokeOffset = (circumference - (porcentaje / 100) * circumference).toFixed(1);
                const fechaSegura = escaparTextoMeta(meta.fecha_limite || '');

                return `
                    <div class="goal-card">
                        <div class="goal-card-top">
                            <div class="goal-header-left">
                                <div class="goal-icon-circle">${meta.icono || '&#127919;'}</div>
                                <span class="goal-title-text">${nombreHtml}</span>
                            </div>
                            <div class="progress-ring-container">
                                <svg class="progress-ring-svg">
                                    <circle class="progress-ring-bg" stroke-width="5" fill="transparent" r="27" cx="30" cy="30"/>
                                    <circle class="progress-ring-fill" stroke-width="5" stroke="#10b981" fill="transparent" r="27" cx="30" cy="30" style="stroke-dashoffset: ${strokeOffset};"/>
                                </svg>
                                <span class="progress-ring-text">${porcentaje}%</span>
                            </div>
                        </div>
                        <div class="goal-amounts-row">${moneda(actual)} / ${moneda(objetivo)}</div>
                        <div class="goal-details-list">
                            <span>Falta: ${moneda(falta)}</span>
                            <span>Fecha: ${escaparTextoMeta(meta.fecha_limite || 'Sin fecha')}</span>
                        </div>
                        <div style="display:flex; gap:8px; margin-top:12px;">
                            <button type="button" class="btn-aportar-goal" style="flex:1;" onclick="openModalAportarMeta('${id}', '${nombreSeguro}')"><i class="fas fa-plus"></i> Aportar</button>
                            <button type="button" class="btn-config-action" onclick="openModalEditarMeta('${id}', '${nombreSeguro}', ${objetivo}, ${actual}, '${fechaSegura}')" title="Editar meta"><i class="fas fa-pen"></i></button>
                            <button type="button" class="btn-delete-goal" onclick="eliminarMetaReal('${id}', '${nombreSeguro}')" title="Eliminar meta"><i class="fas fa-trash"></i></button>
                        </div>
                    </div>
                `;
            }).join('');
        });
    } catch (err) {
        console.error('Error sincronizando ahorro y metas:', err);
        document.querySelectorAll('#containerGoalsGrid, #metasGoalsGrid').forEach(contenedor => {
            contenedor.innerHTML = '<p class="data-state data-state-error">No se pudieron cargar las metas.</p>';
        });
    }
}

function escaparTextoMeta(valor) {
    return String(valor ?? '').replace(/[&<>"']/g, caracter => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[caracter]));
}

document.addEventListener('DOMContentLoaded', cargarMetasYAhorros);
