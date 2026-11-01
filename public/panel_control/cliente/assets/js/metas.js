async function cargarMetasYAhorros() {
    try {
        const respuesta = await fetchMetas();
        const metas = Array.isArray(respuesta) ? respuesta : [];
        const resumen = resumirMetas(metas);
        const moneda = valor => `$${valor.toLocaleString('es-CO')}`;

        document.querySelectorAll('.total-ahorrado-val').forEach(el => {
            el.textContent = moneda(resumen.totalAhorrado);
        });
        document.querySelectorAll('.metas-activas-val').forEach(el => {
            el.textContent = resumen.activas.length;
        });
        const metasCountLabel = document.getElementById('metasCountLabel');
        if (metasCountLabel) {
            const english = window.getCurrentLang?.() === 'en';
            metasCountLabel.textContent = english
                ? `${resumen.activas.length} active · ${resumen.completadas.length} completed`
                : `${resumen.activas.length} activas · ${resumen.completadas.length} terminadas`;
        }
        document.querySelectorAll('.porcentaje-total-val').forEach(el => {
            el.textContent = `${resumen.progresoPromedio}%`;
        });

        ['totalAhorrado', 'valTotalAhorrado', 'valTotalAhorradoMetas'].forEach(id => {
            const el = document.getElementById(id);
            if (el) el.textContent = moneda(resumen.totalAhorrado);
        });
        ['metasActivas', 'valMetasActivasCount', 'valMetasCount'].forEach(id => {
            const el = document.getElementById(id);
            if (el) el.textContent = resumen.activas.length;
        });
        ['porcentajeTotal', 'valPorcentajeTotalMetas', 'valMetasAvgPct'].forEach(id => {
            const el = document.getElementById(id);
            if (el) el.textContent = `${resumen.progresoPromedio}%`;
        });
        const completadasCount = document.getElementById('valMetasCompletadas');
        if (completadasCount) completadasCount.textContent = resumen.completadas.length;

        document.querySelectorAll('.progress-fill-bar').forEach(el => {
            el.style.width = `${resumen.progresoPromedio}%`;
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
        renderMetasProximas(resumen.proximas);

        contenedoresUnicos.forEach(contenedor => {
            if (metas.length === 0) {
                contenedor.innerHTML = '<p class="data-state data-state-empty">No tienes metas registradas aún.</p>';
                return;
            }

            contenedor.innerHTML = metas.map(meta => {
                const id = meta.id ?? meta.id_meta;
                const nombre = meta.nombre ?? meta.nombre_meta ?? 'Meta';
                const actual = Number.parseFloat(meta.monto_actual) || 0;
                const objetivo = Number.parseFloat(meta.monto_objetivo) || 0;
                const goal = resumirMeta(meta);
                const porcentaje = goal.progreso;
                const falta = Math.max(objetivo - actual, 0);
                const english = window.getCurrentLang?.() === 'en';
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
                    <div class="goal-card${goal.completada ? ' is-completed' : ''}">
                        <div class="goal-card-top">
                            <div class="goal-header-left">
                                <div class="goal-icon-circle">${escaparTextoMeta(meta.icono || '🎯')}</div>
                                <span class="goal-title-text">${nombreHtml}</span>
                            </div>
                            <span class="goal-status-badge${goal.completada ? ' is-completed' : ''}">${goal.completada ? (english ? 'Completed' : 'Terminada') : (english ? 'In progress' : 'En progreso')}</span>
                            <div class="progress-ring-container">
                                <svg class="progress-ring-svg">
                                    <circle class="progress-ring-bg" stroke-width="5" fill="transparent" r="27" cx="30" cy="30"/>
                                    <circle class="progress-ring-fill" stroke-width="5" stroke="var(--color-primary)" fill="transparent" r="27" cx="30" cy="30" style="stroke-dashoffset: ${strokeOffset};"/>
                                </svg>
                                <span class="progress-ring-text">${porcentaje}%</span>
                            </div>
                        </div>
                        <div class="goal-amounts-row">${moneda(actual)} / ${moneda(objetivo)}</div>
                        <div class="goal-details-list">
                            <span>Falta: ${moneda(falta)}</span>
                            <span>Fecha: ${escaparTextoMeta(meta.fecha_limite || 'Sin fecha')}</span>
                        </div>
                        <div class="goal-card-actions">
                            ${goal.completada ? '' : `<button type="button" class="btn-aportar-goal" style="flex:1;" onclick="openModalAportarMeta('${id}', '${nombreSeguro}')"><i class="fas fa-plus"></i> Aportar</button>`}
                            <button type="button" class="goal-card-icon-action" onclick="openModalEditarMeta('${id}', '${nombreSeguro}', ${objetivo}, ${actual}, '${fechaSegura}')" title="Editar meta" aria-label="Editar meta"><i class="fas fa-pen"></i></button>
                            <button type="button" class="goal-card-icon-action is-danger" onclick="eliminarMetaReal('${id}', '${nombreSeguro}')" title="Eliminar meta" aria-label="Eliminar meta"><i class="fas fa-trash-can"></i></button>
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
    } finally {
        window.translateStaticContent?.(window.getCurrentLang?.() || 'es');
    }
}

function resumirMeta(meta) {
    const actual = Math.max(0, Number.parseFloat(meta.monto_actual) || 0);
    const objetivo = Math.max(0, Number.parseFloat(meta.monto_objetivo) || 0);
    const estado = String(meta.estado || meta.status || '').trim().toLowerCase();
    const completada = objetivo > 0 && actual >= objetivo ||
        ['completada', 'completado', 'completed', 'terminada', 'terminado'].includes(estado);
    return {
        meta,
        actual,
        objetivo,
        progreso: completada ? 100 : objetivo > 0 ? Math.min(Math.round((actual / objetivo) * 100), 100) : 0,
        completada
    };
}

function resumirMetas(metas) {
    const resumidas = metas.map(resumirMeta);
    const activas = resumidas.filter(goal => !goal.completada);
    const completadas = resumidas.filter(goal => goal.completada);
    const progresoPromedio = resumidas.length
        ? Math.round(resumidas.reduce((total, goal) => total + goal.progreso, 0) / resumidas.length)
        : 0;
    const proximas = [...activas]
        .sort((a, b) => b.progreso - a.progreso ||
            String(a.meta.fecha_limite || '9999-12-31').localeCompare(String(b.meta.fecha_limite || '9999-12-31')))
        .slice(0, 3);
    return {
        activas,
        completadas,
        proximas,
        progresoPromedio,
        totalAhorrado: resumidas.reduce((total, goal) => total + goal.actual, 0)
    };
}

function renderMetasProximas(metas) {
    const container = document.getElementById('metasProximasGrid');
    if (!container) return;
    const english = window.getCurrentLang?.() === 'en';
    if (!metas.length) {
        container.innerHTML = `<p class="data-state data-state-empty">${english ? 'Your active goals will appear here.' : 'Tus metas activas aparecerán aquí.'}</p>`;
        return;
    }

    container.innerHTML = metas.map(({ meta, actual, objetivo, progreso }) => `
        <article class="goal-next-card">
            <div class="goal-next-card-heading">
                <span class="goal-next-icon">${escaparTextoMeta(meta.icono || '🎯')}</span>
                <strong>${escaparTextoMeta(meta.nombre ?? meta.nombre_meta ?? 'Meta')}</strong>
                <span class="goal-next-percent">${progreso}%</span>
            </div>
            <div class="goal-next-progress" role="progressbar" aria-valuenow="${progreso}" aria-valuemin="0" aria-valuemax="100">
                <span style="width: ${progreso}%"></span>
            </div>
            <div class="goal-next-details">
                <span>${new Intl.NumberFormat(english ? 'en-US' : 'es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(Math.max(0, objetivo - actual))} ${english ? 'remaining' : 'por completar'}</span>
                <span>${escaparTextoMeta(meta.fecha_limite || (english ? 'No date' : 'Sin fecha'))}</span>
            </div>
        </article>
    `).join('');
}

function escaparTextoMeta(valor) {
    return String(valor ?? '').replace(/[&<>"']/g, caracter => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[caracter]));
}
