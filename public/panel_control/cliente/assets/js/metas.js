async function cargarMetasYAhorros() {
    try {
        const respuesta = await fetchMetas();
        const metas = Array.isArray(respuesta) ? respuesta : [];
        const resumen = resumirMetas(metas);
        notificarAvanceMetas(metas);
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
            metasCountLabel.innerHTML = `
                <span class="goal-status-summary-item is-progress"><strong>${resumen.activas.length}</strong> ${english ? 'in progress' : 'en progreso'}</span>
                <span class="goal-status-summary-item is-completed"><strong>${resumen.completadas.length}</strong> ${english ? 'completed' : 'terminadas'}</span>`;
        }
        document.querySelectorAll('.porcentaje-total-val').forEach(el => {
            el.textContent = `${resumen.progresoPromedio}%`;
        });

        ['totalAhorrado', 'valTotalAhorrado', 'valTotalAhorradoMetas'].forEach(id => {
            const el = document.getElementById(id);
            if (el) el.textContent = moneda(resumen.totalAhorrado);
        });
        ['metasActivas', 'valMetasActivasCount', 'valMetasEnProgreso'].forEach(id => {
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
                const english = window.getCurrentLang?.() === 'en';
                contenedor.innerHTML = `<p class="data-state data-state-empty">${english ? 'You have no goals yet.' : 'No tienes metas registradas aún.'}</p>`;
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
                const nombreHtml = String(nombre).replace(/[&<>\"]/g, caracter => ({
                    '&': '&amp;',
                    '<': '&lt;',
                    '>': '&gt;',
                    '\"': '&quot;'
                }[caracter]));

                const circumference = 169.64;
                const strokeOffset = (circumference - (porcentaje / 100) * circumference).toFixed(1);
                const fechaSegura = escaparTextoMeta(meta.fecha_limite || '');
                const idSeguro = escaparTextoMeta(id);

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
                            <span>${english ? 'Remaining:' : 'Falta:'} ${moneda(falta)}</span>
                            <span>${english ? 'Due:' : 'Fecha:'} ${escaparTextoMeta(meta.fecha_limite || (english ? 'No date' : 'Sin fecha'))}</span>
                        </div>
                        <div class="goal-card-actions">
                            ${goal.completada ? '' : `<button type="button" class="btn-aportar-goal" style="flex:1;" data-goal-id="${idSeguro}" data-goal-name="${nombreHtml}" data-goal-target="${objetivo}" data-goal-current="${actual}" onclick="openModalAportarMeta(this.dataset.goalId, this.dataset.goalName, Number(this.dataset.goalTarget), Number(this.dataset.goalCurrent))"><i class="fas fa-plus"></i> ${english ? 'Contribute' : 'Aportar'}</button>`}
                            <button type="button" class="goal-card-icon-action" data-goal-id="${idSeguro}" data-goal-name="${nombreHtml}" data-goal-target="${objetivo}" data-goal-current="${actual}" data-goal-date="${fechaSegura}" onclick="openModalEditarMeta(this.dataset.goalId, this.dataset.goalName, Number(this.dataset.goalTarget), Number(this.dataset.goalCurrent), this.dataset.goalDate)" title="${english ? 'Edit goal' : 'Editar meta'}" aria-label="${english ? 'Edit goal' : 'Editar meta'}"><i class="fas fa-pen"></i></button>
                            <button type="button" class="goal-card-icon-action is-danger" data-goal-id="${idSeguro}" data-goal-name="${nombreHtml}" onclick="eliminarMetaReal(this.dataset.goalId, this.dataset.goalName)" title="${english ? 'Delete goal' : 'Eliminar meta'}" aria-label="${english ? 'Delete goal' : 'Eliminar meta'}"><i class="fas fa-trash-can"></i></button>
                        </div>
                    </div>
                `;
            }).join('');
        });
    } catch (err) {
        console.error('Error sincronizando ahorro y metas:', err);
        const english = window.getCurrentLang?.() === 'en';
        document.querySelectorAll('#containerGoalsGrid, #metasGoalsGrid').forEach(contenedor => {
            contenedor.innerHTML = `<p class="data-state data-state-error">${english ? 'Goals could not be loaded.' : 'No se pudieron cargar las metas.'}</p>`;
        });
    } finally {
        window.translateStaticContent?.(window.getCurrentLang?.() || 'es');
    }
}

function notificarAvanceMetas(metas) {
    if (typeof triggerSystemNotif !== 'function') return;
    const english = window.getCurrentLang?.() === 'en';
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    metas.forEach(meta => {
        const goal = resumirMeta(meta);
        const id = meta.id ?? meta.id_meta;
        const nombre = String(meta.nombre ?? meta.nombre_meta ?? (english ? 'Goal' : 'Meta'));
        if (goal.completada) {
            triggerSystemNotif(
                english ? '🎉 Goal completed' : '🎉 ¡Terminaste tu meta!',
                english ? `You completed "${nombre}". Congratulations!` : `Completaste "${nombre}". ¡Felicitaciones!`,
                { type: 'goal', target: 'view-metas', dedupeKey: `goal:${id}:completed` }
            );
            return;
        }

        if (goal.progreso >= 90) {
            const remainingPercent = Math.max(0, 100 - goal.progreso);
            triggerSystemNotif(
                english ? '✨ Goal almost complete' : '✨ ¡Tu meta está por completarse!',
                english
                    ? `${remainingPercent}% remaining to complete "${nombre}".`
                    : `Te falta ${remainingPercent}% para terminar "${nombre}".`,
                { type: 'goal', target: 'view-metas', dedupeKey: `goal:${id}:progress-90` }
            );
        }

        if (!meta.fecha_limite) return;
        const deadline = new Date(`${meta.fecha_limite}T00:00:00`);
        if (Number.isNaN(deadline.getTime())) return;
        const daysRemaining = Math.round((deadline.getTime() - today.getTime()) / 86400000);
        if (![7, 3, 1, 0].includes(daysRemaining)) return;
        const when = daysRemaining === 0
            ? (english ? 'today' : 'hoy')
            : (english
                ? `in ${daysRemaining} ${daysRemaining === 1 ? 'day' : 'days'}`
                : `en ${daysRemaining} ${daysRemaining === 1 ? 'día' : 'días'}`);
        triggerSystemNotif(
            english ? '⏳ Goal deadline approaching' : '⏳ Se acerca el plazo de tu meta',
            english
                ? `The deadline for "${nombre}" ends ${when}.`
                : `El plazo de "${nombre}" termina ${when}.`,
            { type: 'goal', target: 'view-metas', dedupeKey: `goal:${id}:deadline:${meta.fecha_limite}:${daysRemaining}` }
        );
    });
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
