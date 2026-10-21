async function cargarPanelInicio() {
    try {
        const token = localStorage.getItem('notaire_token');
        if (!token) return;

        const elementoSaludo = document.getElementById('nombre-usuario-saludo');
        const elementoPerfil = document.getElementById('sidebarUserName');
        const elementoAvatar = document.getElementById('sidebarAvatarInitials');
        const elementoConfigNombre = document.getElementById('configNombre');
        const elementoConfigEmail = document.getElementById('configEmail');
        const elementoConfigAvatar = document.getElementById('configAvatarLarge');
        const elementoPerfilNombre = document.getElementById('perfilNombre');
        const elementoPerfilEmail = document.getElementById('perfilEmail');
        const textoSaludo = document.getElementById('saludo-texto');
        const usuarioGuardado = localStorage.getItem('notaire_user');
        let nombreCompleto = 'Usuario';

        if (usuarioGuardado) {
            try {
                const usuario = JSON.parse(usuarioGuardado);
                nombreCompleto = usuario.nombre || usuario.full_name || usuario.email?.split('@')[0] || 'Usuario';
            } catch (error) {
                console.error('Error al leer el usuario de la sesión:', error);
            }
        }

        const primerNombre = String(nombreCompleto).trim().split(/\s+/)[0] || 'Usuario';
        const nombreFormateado = primerNombre.charAt(0).toUpperCase() + primerNombre.slice(1).toLowerCase();
        const hora = new Date().getHours();
        const saludo = hora >= 6 && hora < 12
            ? '¡Buenos días,'
            : hora >= 12 && hora < 19
                ? '¡Buenas tardes,'
                : '¡Buenas noches,';

        if (elementoSaludo) elementoSaludo.textContent = nombreFormateado;
        if (elementoPerfil) elementoPerfil.textContent = nombreCompleto;
        if (elementoAvatar) elementoAvatar.textContent = nombreCompleto.split(/\s+/).map(parte => parte[0]).join('').slice(0, 2).toUpperCase();
        if (elementoConfigNombre) elementoConfigNombre.textContent = nombreCompleto;
        if (elementoConfigEmail) elementoConfigEmail.textContent = usuarioGuardado ? (JSON.parse(usuarioGuardado).email || 'Sin correo') : 'Sin correo';
        if (elementoConfigAvatar) elementoConfigAvatar.textContent = nombreCompleto.split(/\s+/).map(parte => parte[0]).join('').slice(0, 2).toUpperCase();
        if (elementoPerfilNombre) elementoPerfilNombre.value = nombreCompleto;
        if (elementoPerfilEmail && usuarioGuardado) elementoPerfilEmail.value = JSON.parse(usuarioGuardado).email || '';
        if (textoSaludo) textoSaludo.textContent = saludo;

        const headers = { Authorization: `Bearer ${token}` };
        const [resTrans, resMetas] = await Promise.all([
            fetch('/api/transacciones', { headers }),
            fetch('/api/metas', { headers })
        ]);

        if (!resTrans.ok || !resMetas.ok) throw new Error('Error al obtener datos');

        const transaccionesRespuesta = await resTrans.json();
        const metasRespuesta = await resMetas.json();
        const transacciones = Array.isArray(transaccionesRespuesta) ? transaccionesRespuesta : [];
        const metas = Array.isArray(metasRespuesta) ? metasRespuesta : [];
        const mesActual = window.NotaireFinancialChart?.currentMonthKey();
        const transaccionesMes = window.NotaireFinancialChart
            ? window.NotaireFinancialChart.filterTransactionsByMonth(transacciones, mesActual)
            : transacciones.filter(transaccion => String(transaccion.fecha || '').slice(0, 7) === mesActual);
        const normalizarTipo = transaccion => window.NotaireFinancialChart
            ? window.NotaireFinancialChart.getTransactionType(transaccion)
            : String(transaccion.tipo || transaccion.tipo_registro || '').toLowerCase();
        const sumarTipo = tipo => transaccionesMes
            .filter(transaccion => normalizarTipo(transaccion) === tipo)
            .reduce((total, transaccion) => total + (Number(transaccion.monto) || 0), 0);
        const ingresosMes = sumarTipo('ingreso');
        const gastosMes = sumarTipo('gasto');

        let ahorrosTotales = 0;
        let sumaPorcentajes = 0;
        metas.forEach(meta => {
            const actual = Number.parseFloat(meta.monto_actual) || 0;
            const objetivo = Number.parseFloat(meta.monto_objetivo) || 1;
            ahorrosTotales += actual;
            sumaPorcentajes += Math.min((actual / objetivo) * 100, 100);
        });

        const pctPromedioMetas = metas.length > 0
            ? Math.round(sumaPorcentajes / metas.length)
            : 0;
        const moneda = valor => `$${valor.toLocaleString('es-CO')}`;
        const actualizarTexto = (id, texto) => {
            const elemento = document.getElementById(id);
            if (elemento) elemento.textContent = texto;
        };

        actualizarTexto('kpiIngresosMes', moneda(ingresosMes));
        actualizarTexto('kpiGastosMes', moneda(gastosMes));
        actualizarTexto('kpiAhorrosTotales', moneda(ahorrosTotales));
        actualizarTexto('kpiMetasActivas', `${metas.length} metas (${pctPromedioMetas}% promedio)`);
        actualizarTexto('kpiMetasPromedio', `${pctPromedioMetas}% promedio`);

        const escaparHtml = valor => String(valor ?? '').replace(/[&<>"']/g, caracter => ({
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;',
            "'": '&#39;'
        }[caracter]));

        const contActividad = document.getElementById('listaActividadReciente');
        if (contActividad) {
            const ultimasTransacciones = [...transacciones]
                .sort((a, b) => new Date(b.fecha) - new Date(a.fecha))
                .slice(0, 4);

            contActividad.innerHTML = ultimasTransacciones.length === 0
                ? '<p style="color: #888; padding: 12px 0;">No hay movimientos recientes.</p>'
                : ultimasTransacciones.map(transaccion => {
                    const esIngreso = normalizarTipo(transaccion) === 'ingreso';
                    const monto = Number.parseFloat(transaccion.monto) || 0;
                    const concepto = transaccion.descripcion || transaccion.categoria || 'Movimiento';
                    const categoria = transaccion.categoria || '';
                    return `
                        <div class="transaction-row">
                            <div class="transaction-left">
                                <div class="transaction-icon-box">${esIngreso ? '&#128188;' : '&#129529;'}</div>
                                <div class="transaction-info">
                                    <span class="transaction-title">${escaparHtml(concepto)}</span>
                                    <span class="transaction-date">${escaparHtml(transaccion.fecha || '')}${categoria ? ` • ${escaparHtml(categoria)}` : ''}</span>
                                </div>
                            </div>
                            <span class="${esIngreso ? 'transaction-amount-positive' : 'transaction-amount-negative'}">${esIngreso ? '+' : '-'}${moneda(monto)}</span>
                        </div>
                    `;
                }).join('');
        }

        const contProgresoMetas = document.getElementById('widgetProgresoMetas');
        if (contProgresoMetas) {
            contProgresoMetas.innerHTML = metas.length === 0
                ? '<p style="color: #888; padding: 12px 0;">No hay metas registradas.</p>'
                : metas.map(meta => {
                    const actual = Number.parseFloat(meta.monto_actual) || 0;
                    const objetivo = Number.parseFloat(meta.monto_objetivo) || 1;
                    const porcentaje = Math.min(Math.round((actual / objetivo) * 100), 100);
                    const nombre = meta.nombre || meta.nombre_meta || 'Meta';
                    const icono = meta.icono ? escaparHtml(meta.icono) : '&#127919;';
                    return `
                        <div class="home-goal-row">
                            <div class="home-goal-left">
                                <span class="home-goal-icon">${icono}</span>
                                <div class="home-goal-info">
                                    <span class="home-goal-name">${escaparHtml(nombre)}</span>
                                    <div class="home-goal-bar"><div class="home-goal-fill" style="width: ${porcentaje}%; background: #10b981;"></div></div>
                                </div>
                            </div>
                            <span class="home-goal-pct" style="color: #10b981;">${porcentaje}%</span>
                        </div>
                    `;
                }).join('');
        }
    } catch (err) {
        console.error('Error al actualizar el panel de inicio:', err);
    }
}

document.addEventListener('DOMContentLoaded', cargarPanelInicio);
