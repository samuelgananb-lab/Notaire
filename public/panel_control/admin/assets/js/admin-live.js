const ADMIN_SUMMARY_URL = '/api/admin/summary';

const adminCurrency = value => new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    maximumFractionDigits: 0
}).format(Number(value) || 0);

function adminEscape(value) {
    return String(value ?? '').replace(/[&<>"']/g, character => ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;'
    }[character]));
}

function adminTransactionIcon(transaction) {
    return transaction.tipo === 'ingreso' ? '💼' : '🧾';
}

function renderAdminTransactions(items) {
    const container = document.getElementById('adminRecentTransactions');
    if (!container) return;

    if (!items.length) {
        container.innerHTML = '<p class="data-state data-state-empty">No hay movimientos registrados.</p>';
        return;
    }

    container.innerHTML = items.map(transaction => {
        const income = transaction.tipo === 'ingreso';
        const sign = income ? '+' : '-';
        return `
            <div class="transaction-row">
                <div class="transaction-left">
                    <div class="transaction-icon-box">${adminTransactionIcon(transaction)}</div>
                    <div class="transaction-info">
                        <span class="transaction-title">${adminEscape(transaction.descripcion || transaction.categoria || 'Movimiento')}</span>
                        <span class="transaction-date">${adminEscape(transaction.usuario_nombre)} · ${adminEscape(transaction.fecha || '')}</span>
                    </div>
                </div>
                <span class="${income ? 'transaction-amount-positive' : 'transaction-amount-negative'}">${sign}${adminCurrency(transaction.monto)}</span>
            </div>
        `;
    }).join('');
}

function renderAdminTransactionList(containerId, items) {
    const container = document.getElementById(containerId);
    if (!container) return;

    if (!items.length) {
        container.innerHTML = '<p class="data-state data-state-empty">No hay movimientos registrados.</p>';
        return;
    }

    container.innerHTML = items.slice(0, 6).map(transaction => {
        const income = transaction.tipo === 'ingreso';
        return `
            <div class="transaction-row">
                <div class="transaction-left">
                    <div class="transaction-icon-box">${adminTransactionIcon(transaction)}</div>
                    <div class="transaction-info">
                        <span class="transaction-title">${adminEscape(transaction.descripcion || transaction.categoria || 'Movimiento')}</span>
                        <span class="transaction-date">${adminEscape(transaction.usuario_nombre || '')} · ${adminEscape(transaction.fecha || '')}</span>
                    </div>
                </div>
                <span class="${income ? 'transaction-amount-positive' : 'transaction-amount-negative'}">${income ? '+' : '-'}${adminCurrency(transaction.monto)}</span>
            </div>
        `;
    }).join('');
}

function renderAdminGoals(goals) {
    const container = document.getElementById('adminGoalsList');
    if (!container) return;

    if (!goals.length) {
        container.innerHTML = '<p class="data-state data-state-empty">No hay metas registradas.</p>';
        return;
    }

    const colors = ['#10b981', '#3b82f6', '#f59e0b', '#8b5cf6', '#06b6d4'];
    container.innerHTML = goals.map((goal, index) => {
        const percentage = Math.max(0, Math.min(100, Number(goal.porcentaje) || 0));
        const color = colors[index % colors.length];
        return `
            <div class="home-goal-row">
                <div class="home-goal-left">
                    <span class="home-goal-icon">🎯</span>
                    <div class="home-goal-info">
                        <span class="home-goal-name">${adminEscape(goal.nombre || 'Meta')}</span>
                        <div class="home-goal-bar">
                            <div class="home-goal-fill" style="width: ${percentage}%; background: ${color};"></div>
                        </div>
                    </div>
                </div>
                <span class="home-goal-pct" style="color: ${color};">${percentage}%</span>
            </div>
        `;
    }).join('');
}

function renderAdminContributions(items) {
    const container = document.getElementById('listAhorrosRecientes');
    if (!container) return;
    if (!items.length) {
        container.innerHTML = '<p class="data-state data-state-empty">No hay aportes registrados.</p>';
        return;
    }
    container.innerHTML = items.map(item => `
        <div class="transaction-row">
            <div class="transaction-left">
                <div class="transaction-icon-box">💚</div>
                <div class="transaction-info">
                    <span class="transaction-title">${adminEscape(item.meta_nombre)}</span>
                    <span class="transaction-date">${adminEscape(item.usuario_nombre)} · ${adminEscape(item.fecha || '')}</span>
                </div>
            </div>
            <span class="transaction-amount-positive">+${adminCurrency(item.monto)}</span>
        </div>
    `).join('');
}

function adminAggregate(items, key) {
    const totals = new Map();
    items.forEach(item => {
        const amount = Number(item.monto);
        if (!Number.isFinite(amount) || amount <= 0) return;
        const label = String(item[key] || '').trim() || 'Otros';
        totals.set(label, (totals.get(label) || 0) + amount);
    });
    return [...totals.entries()].sort((a, b) => b[1] - a[1]);
}

function renderAdminLegend(containerId, entries, colors) {
    const container = document.getElementById(containerId);
    if (!container) return;
    const total = entries.reduce((sum, [, amount]) => sum + amount, 0);
    container.innerHTML = entries.length
        ? entries.map(([label, amount], index) => `
            <div class="legend-item"><span class="legend-dot" style="background: ${colors[index % colors.length]};"></span>
                ${adminEscape(label)} ${total ? Math.round((amount / total) * 100) : 0}%</div>
        `).join('')
        : '<span class="data-state data-state-empty">Sin datos</span>';
}

function renderAdminAssets(items) {
    const container = document.getElementById('adminAssetsList');
    if (!container) return;
    if (!items.length) {
        container.innerHTML = '<p class="data-state data-state-empty">No hay patrimonio registrado.</p>';
        return;
    }
    container.innerHTML = items.slice(0, 6).map(item => `
        <div class="transaction-row">
            <div class="transaction-left">
                <div class="transaction-icon-box">🏛️</div>
                <div class="transaction-info"><span class="transaction-title">${adminEscape(item.categoria || item.tipo)}</span></div>
            </div>
            <span class="transaction-amount-positive">${adminCurrency(item.monto)}</span>
        </div>
    `).join('');
}

function renderAdminFinancialSummary(summary) {
    const container = document.getElementById('adminFinancialSummary');
    if (!container) return;
    container.innerHTML = `
        <div class="summary-financial-row"><span class="summary-financial-label">Ingresos este mes</span><span class="transaction-amount-positive">+${adminCurrency(summary.ingresosMes)}</span></div>
        <div class="summary-financial-row"><span class="summary-financial-label">Gastos este mes</span><span class="transaction-amount-negative">-${adminCurrency(summary.gastosMes)}</span></div>
        <div class="summary-financial-row"><span class="summary-financial-label">Ahorros acumulados</span><span class="transaction-amount-positive">+${adminCurrency(summary.totalAhorrado)}</span></div>
        <div class="summary-financial-row"><span class="summary-financial-label" style="font-weight: 700; color: white;">Liquidez</span><span class="summary-net-glow">${adminCurrency(summary.liquidez)}</span></div>
        <div class="summary-financial-row"><span class="summary-financial-label">Movimiento total</span><span class="summary-financial-label">${adminCurrency(summary.movimientoTotal)}</span></div>
    `;
}

function renderAdminExpenseCategories(items) {
    const container = document.getElementById('listMayoresGastos');
    if (!container) return;
    const monthKey = window.NotaireFinancialChart?.currentMonthKey();
    const monthExpenses = (items || []).filter(item => (
        window.NotaireFinancialChart?.getTransactionType(item) === 'gasto'
        && String(item.fecha || '').slice(0, 7) === monthKey
    ));
    const entries = adminAggregate(monthExpenses, 'categoria');
    const total = entries.reduce((sum, [, amount]) => sum + amount, 0);
    const colors = ['#f59e0b', '#8b5cf6', '#06b6d4', '#10b981', '#64748b'];
    container.innerHTML = entries.length
        ? entries.slice(0, 5).map(([label, amount], index) => {
            const percentage = total ? Math.round((amount / total) * 100) : 0;
            return `<div class="category-progress-item">
                <div class="category-info-row"><span class="category-name-icon">${adminEscape(label)}</span>
                    <div class="category-amount-pct"><span class="category-amount">${adminCurrency(amount)}</span><span class="category-pct">${percentage}%</span></div>
                </div>
                <div class="progress-track-bg"><div class="progress-fill-bar" style="width: ${percentage}%; background: ${colors[index % colors.length]};"></div></div>
            </div>`;
        }).join('')
        : '<p class="data-state data-state-empty">No hay gastos registrados.</p>';
}

function updateAdminCharts(summary, monthTransactions) {
    const getType = item => window.NotaireFinancialChart
        ? window.NotaireFinancialChart.getTransactionType(item)
        : String(item.tipo || item.tipo_registro || '').toLowerCase();
    const expenses = adminAggregate(monthTransactions.filter(item => getType(item) === 'gasto'), 'categoria');
    const income = adminAggregate(monthTransactions.filter(item => getType(item) === 'ingreso'), 'categoria');
    const distribution = window.NotaireFinancialChart
        ? window.NotaireFinancialChart.calculateFinancialDistribution(
            summary.totalIngresos,
            summary.totalGastos,
            summary.totalAhorrado
        )
        : {
            labels: ['Gastos', 'Ahorros', 'Disponible'],
            values: [
                Number(summary.totalGastos) || 0,
                Number(summary.totalAhorrado) || 0,
                Math.max(0, Number(summary.saldoDisponible) || 0)
            ]
        };
    const distributionEntries = distribution.labels
        .map((label, index) => [label, distribution.values[index]])
        .filter(([, amount]) => amount > 0);
    const colors = ['#f59e0b', '#8b5cf6', '#06b6d4', '#10b981', '#64748b'];

    renderAdminLegend('adminExpenseLegend', expenses, colors);
    renderAdminLegend('adminIncomeLegend', income, colors);
    renderAdminLegend('adminAssetsLegend', distributionEntries, ['#ef4444', '#a855f7', '#3b82f6']);
    renderAdminAssets(summary.activos || []);
    renderAdminFinancialSummary(summary);
    document.getElementById('centerActivosTotal').textContent = adminCurrency(summary.saldoDisponible);

    if (typeof chartEvolucionIngresosInstance !== 'undefined' && chartEvolucionIngresosInstance && window.NotaireFinancialChart) {
        const series = window.NotaireFinancialChart.createMonthlyTotals(summary.transactions || []);
        chartEvolucionIngresosInstance.data.labels = series.labels;
        chartEvolucionIngresosInstance.data.datasets[0].data = series.values;
        chartEvolucionIngresosInstance.update();
    }
    if (typeof chartGastosDonaInstance !== 'undefined' && chartGastosDonaInstance) {
        chartGastosDonaInstance.data.labels = expenses.map(([label]) => label);
        chartGastosDonaInstance.data.datasets[0].data = expenses.map(([, amount]) => amount);
        chartGastosDonaInstance.update();
    }
    if (typeof chartFuentesIngresosInstance !== 'undefined' && chartFuentesIngresosInstance) {
        chartFuentesIngresosInstance.data.labels = income.map(([label]) => label);
        chartFuentesIngresosInstance.data.datasets[0].data = income.map(([, amount]) => amount);
        chartFuentesIngresosInstance.update();
    }
    if (typeof chartDistribucionActivosInstance !== 'undefined' && chartDistribucionActivosInstance) {
        chartDistribucionActivosInstance.data.labels = distribution.labels;
        chartDistribucionActivosInstance.data.datasets[0].data = distribution.values;
        chartDistribucionActivosInstance.data.datasets[0].backgroundColor = ['#ef4444', '#a855f7', '#3b82f6'];
        chartDistribucionActivosInstance.update();
    }
    if (typeof chartPatrimonioEvolucionInstance !== 'undefined' && chartPatrimonioEvolucionInstance && window.NotaireFinancialChart) {
        const series = window.NotaireFinancialChart.createMonthlySeries(summary.transactions || []);
        chartPatrimonioEvolucionInstance.data.labels = series.labels;
        chartPatrimonioEvolucionInstance.data.datasets[0].data = series.values;
        chartPatrimonioEvolucionInstance.update();
    }
}

function updateAdminProfile() {
    const storedUser = localStorage.getItem('notaire_user');
    if (!storedUser) return;

    try {
        const user = JSON.parse(storedUser);
        const name = user.nombre || user.email || 'Administrador';
        const role = String(user.rol || (localStorage.getItem('user_role') || 'admin')).toLowerCase();
        const firstName = name.split(/\s+/)[0];
        const initials = name.split(/\s+/).map(part => part[0]).join('').slice(0, 2).toUpperCase();
        document.getElementById('sidebarUserName')?.replaceChildren(document.createTextNode(name));
        document.getElementById('heroUserName')?.replaceChildren(document.createTextNode(firstName));
        document.querySelector('#sidebarAvatarCircle span')?.replaceChildren(document.createTextNode(initials));
        document.getElementById('sidebarRoleLabel')?.replaceChildren(document.createTextNode(role === 'empleado' ? 'Empleado operativo' : 'Administrador'));
        if (role === 'empleado') {
            document.body.classList.add('employee-mode');
            document.getElementById('sidebarMenu')?.querySelectorAll('.finance-only').forEach(item => item.remove());
            ['view-usuarios', 'view-auditoria', 'view-reportes'].forEach(viewId => {
                document.querySelector(`#sidebarMenu a[data-target="${viewId}"]`)?.closest('li')?.remove();
            });
        }
    } catch (error) {
        console.warn('No se pudo cargar el perfil administrativo:', error);
    }
}

function isEmployeeSession() {
    try {
        const user = JSON.parse(localStorage.getItem('notaire_user') || '{}');
        return String(user.rol || localStorage.getItem('user_role') || '').toLowerCase() === 'empleado';
    } catch {
        return false;
    }
}

async function loadAdminSummary() {
    const token = localStorage.getItem('notaire_token');
    if (!token || isEmployeeSession()) return;

    try {
        const response = await fetch(ADMIN_SUMMARY_URL + (window.NotaireFinancialChart?.monthQuery() || ''), {
            headers: { Authorization: `Bearer ${token}` }
        });
        if (!response.ok) throw new Error('No se pudo cargar el resumen administrativo');

        const summary = await response.json();
        const employeeView = summary.employeeScope === true;
        const transactions = summary.transactions || [];
        const currentMonth = window.NotaireFinancialChart?.currentMonthKey();
        const monthTransactions = window.NotaireFinancialChart
            ? window.NotaireFinancialChart.filterTransactionsByMonth(transactions, currentMonth)
            : transactions.filter(transaction => String(transaction.fecha || '').slice(0, 7) === currentMonth);
        const getType = transaction => window.NotaireFinancialChart
            ? window.NotaireFinancialChart.getTransactionType(transaction)
            : String(transaction.tipo || transaction.tipo_registro || '').toLowerCase();
        const monthExpenses = monthTransactions.filter(transaction => getType(transaction) === 'gasto');
        const monthIncome = monthTransactions.filter(transaction => getType(transaction) === 'ingreso');
        const goalObjectiveTotal = (summary.goals || []).reduce((total, goal) => total + Number(goal.monto_objetivo || 0), 0);
        const goalProgress = goalObjectiveTotal ? Math.min(100, Math.round((summary.totalAhorrado / goalObjectiveTotal) * 100)) : 0;
        if (typeof NotaireState !== 'undefined') {
            NotaireState.user = JSON.parse(localStorage.getItem('notaire_user') || '{}');
            NotaireState.gastos = transactions.filter(transaction => getType(transaction) === 'gasto');
            NotaireState.ingresos = transactions.filter(transaction => getType(transaction) === 'ingreso');
            NotaireState.metas = (summary.goals || []).map(goal => ({
                ...goal,
                actual: Number(goal.monto_actual || 0),
                objetivo: Number(goal.monto_objetivo || 0),
                fecha: goal.fecha_limite || '',
                nombre: goal.nombre || 'Meta'
            }));
        }
        document.getElementById('adminNetWorth').textContent = adminCurrency(summary.liquidez);
        document.getElementById('adminIncomeMonth').textContent = adminCurrency(summary.ingresosMes);
        document.getElementById('adminExpenseMonth').textContent = adminCurrency(summary.gastosMes);
        document.getElementById('adminUsersTotal').textContent = employeeView ? 'Restringido' : (summary.usuariosTotal || 0);
        document.getElementById('adminClientsTotal').textContent = employeeView ? 'Restringido' : (summary.clientesTotal || 0);
        document.getElementById('valGastadoEsteMes').textContent = adminCurrency(monthExpenses.reduce((total, item) => total + Number(item.monto || 0), 0));
        document.getElementById('centerGastosTotal').textContent = adminCurrency(summary.gastosMes);
        const budget = Number(localStorage.getItem('notaire_presupuesto') || 0);
        if (typeof NotaireState !== 'undefined') NotaireState.presupuestoTotal = budget;
        const budgetPosition = window.NotaireFinancialChart
            ? window.NotaireFinancialChart.calculateBudgetPosition(budget, summary.gastosMes)
            : { hasBudget: budget > 0, available: budget - summary.gastosMes, percentUsed: budget > 0 ? (summary.gastosMes / budget) * 100 : null };
        const budgetInput = document.getElementById('cfgPresupuesto');
        if (budgetInput) budgetInput.value = budget > 0 ? String(budget) : '';
        document.getElementById('valPresupuestoTotal').textContent = budgetPosition.hasBudget ? adminCurrency(budget) : 'Sin presupuesto';
        document.getElementById('valDisponibleGastos').textContent = adminCurrency(summary.liquidez);
        document.getElementById('valPresupuestoPct').textContent = budgetPosition.hasBudget
            ? `${Math.round(budgetPosition.percentUsed)}% utilizado`
            : 'Sin presupuesto';
        document.getElementById('valTotalIngresos').textContent = adminCurrency(summary.ingresosMes);
        document.getElementById('centerIngresosTotal').textContent = adminCurrency(summary.ingresosMes);
        const monthlyIncomeAverage = window.NotaireFinancialChart
            ? window.NotaireFinancialChart.averageMonthlyTotal(transactions, 'ingreso')
            : monthIncome.reduce((total, item) => total + Number(item.monto || 0), 0);
        const largestMonthlyIncome = monthIncome.reduce((largest, item) => Math.max(largest, Number(item.monto || 0)), 0);
        document.getElementById('valPromedioMensual').textContent = adminCurrency(monthlyIncomeAverage);
        document.getElementById('valMayorIngreso').textContent = adminCurrency(largestMonthlyIncome);
        document.getElementById('valTotalAhorrado').textContent = adminCurrency(summary.totalAhorrado);
        document.getElementById('valMetasActivasCount').textContent = summary.metasActivas || 0;
        document.getElementById('valPorcentajeTotalMetas').textContent = `${goalProgress}%`;
        document.getElementById('valPatrimonioNeto').textContent = adminCurrency(summary.liquidez);
        document.getElementById('valMovimientoTotal').textContent = adminCurrency(summary.movimientoTotal);        document.getElementById('valLiquidezPct').textContent = adminCurrency(summary.totalAhorrado);
        document.getElementById('valTotalAhorradoMetas').textContent = adminCurrency(summary.totalAhorrado);
        document.getElementById('valMetasCount').textContent = summary.metasActivas || 0;
        document.getElementById('valMetasAvgPct').textContent = `${goalProgress}%`;
        renderAdminTransactions(summary.recentTransactions || []);
        renderAdminGoals(summary.topGoals || []);
        renderAdminTransactionList('listUltimosMovimientos', monthExpenses);
        renderAdminTransactionList('listUltimosIngresos', monthIncome);
        renderAdminContributions(summary.recentContributions || []);
        renderAdminExpenseCategories(monthExpenses);
        renderAdminAssets(summary.activos || []);
        updateAdminCharts(summary, monthTransactions);
        if (typeof renderGoalsGrid === 'function') renderGoalsGrid();
        if (typeof renderMetasView === 'function') renderMetasView();
    } catch (error) {
        console.error('Error al cargar el resumen administrativo:', error);
        ['adminNetWorth', 'adminUsersTotal', 'adminClientsTotal', 'adminIncomeMonth', 'adminExpenseMonth'].forEach(id => {
            const element = document.getElementById(id);
            if (element) element.textContent = 'No disponible';
        });
    }
}

async function adminRequest(url, options = {}) {
    const token = localStorage.getItem('notaire_token');
    const response = await fetch(url, {
        ...options,
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}`, ...(options.headers || {}) }
    });
    const contentType = response.headers.get('content-type') || '';
    if (!contentType.includes('application/json')) {
        if (!response.ok) {
            throw new Error(`El servidor respondió HTTP ${response.status} sin JSON. Comprueba que el backend esté actualizado y reiniciado.`);
        }
        throw new Error('El servidor devolvió una respuesta inesperada; no se pudo confirmar la operación.');
    }

    const result = await response.json();
    if (!response.ok) throw new Error(result.detalle || result.error || 'No se pudo completar la operación');
    return result;
}

async function handleGuardarGasto(event) {
    event.preventDefault();
    try {
        await adminRequest('/api/transacciones', {
            method: 'POST',
            body: JSON.stringify({
                tipo: 'gasto',
                monto: Number(document.getElementById('gastoMonto')?.value),
                categoria: document.getElementById('gastoCategoria')?.value,
                descripcion: document.getElementById('gastoDescripcion')?.value,
                fecha: document.getElementById('gastoFecha')?.value
            })
        });
        closeModal('modalRegistrarGasto');
        await loadAdminSummary();
        showToast('Gasto guardado correctamente');
    } catch (error) { showToast(error.message); }
}

async function handleGuardarIngreso(event) {
    event.preventDefault();
    try {
        await adminRequest('/api/transacciones', {
            method: 'POST',
            body: JSON.stringify({
                tipo: 'ingreso',
                monto: Number(document.getElementById('ingresoMonto')?.value),
                categoria: document.getElementById('ingresoCategoria')?.value,
                descripcion: document.getElementById('ingresoDescripcion')?.value,
                fecha: document.getElementById('ingresoFecha')?.value
            })
        });
        closeModal('modalRegistrarIngreso');
        await loadAdminSummary();
        showToast('Ingreso guardado correctamente');
    } catch (error) { showToast(error.message); }
}

async function handleGuardarNuevaMeta(event) {
    event.preventDefault();
    try {
        await adminRequest('/api/metas', {
            method: 'POST',
            body: JSON.stringify({
                nombre: document.getElementById('metaNombre')?.value,
                monto_objetivo: Number(document.getElementById('metaObjetivo')?.value),
                monto_actual: Number(document.getElementById('metaInicial')?.value || 0),
                fecha_limite: document.getElementById('metaFecha')?.value,
                icono: document.getElementById('metaIcono')?.value
            })
        });
        closeModal('modalNuevaMeta');
        await loadAdminSummary();
        showToast('Meta guardada correctamente');
    } catch (error) { showToast(error.message); }
}

async function handleGuardarAporteMeta(event) {
    event.preventDefault();
    try {
        await adminRequest('/api/metas/aportar', {
            method: 'POST',
            body: JSON.stringify({
                meta_id: document.getElementById('aporteMetaId')?.value,
                monto: Number(document.getElementById('aporteMonto')?.value)
            })
        });
        closeModal('modalAportarMeta');
        await loadAdminSummary();
        showToast('Aporte guardado correctamente');
    } catch (error) { showToast(error.message); }
}

function findAdminTransaction(id) {
    const numericId = Number(id);
    return [...(NotaireState.gastos || []), ...(NotaireState.ingresos || [])].find(item => Number(item.id) === numericId);
}

function openModalEditarGasto(id) {
    const transaction = findAdminTransaction(id);
    if (!transaction) return;
    document.getElementById('editGastoId').value = transaction.id;
    document.getElementById('editGastoMonto').value = transaction.monto;
    document.getElementById('editGastoCategoria').value = transaction.categoria || '';
    document.getElementById('editGastoDescripcion').value = transaction.descripcion || '';
    document.getElementById('editGastoFecha').value = transaction.fecha || '';
    openModal('modalEditarGasto');
}

async function handleGuardarEdicionGasto(event) {
    event.preventDefault();
    try {
        await adminRequest(`/api/transacciones/${encodeURIComponent(document.getElementById('editGastoId')?.value)}`, {
            method: 'PUT',
            body: JSON.stringify({
                tipo: 'gasto',
                monto: Number(document.getElementById('editGastoMonto')?.value),
                categoria: document.getElementById('editGastoCategoria')?.value,
                descripcion: document.getElementById('editGastoDescripcion')?.value,
                fecha: document.getElementById('editGastoFecha')?.value
            })
        });
        closeModal('modalEditarGasto');
        await loadAdminSummary();
        showToast('Gasto actualizado correctamente');
    } catch (error) { showToast(error.message); }
}

async function eliminarGasto(id) {
    if (!window.confirm('¿Eliminar este gasto?')) return;
    try {
        await adminRequest(`/api/transacciones/${encodeURIComponent(id)}`, { method: 'DELETE' });
        await loadAdminSummary();
        showToast('Gasto eliminado');
    } catch (error) { showToast(error.message); }
}

function openModalEditarIngreso(id) {
    const transaction = findAdminTransaction(id);
    if (!transaction) return;
    document.getElementById('editIngresoId').value = transaction.id;
    document.getElementById('editIngresoMonto').value = transaction.monto;
    document.getElementById('editIngresoFuente').value = transaction.categoria || '';
    document.getElementById('editIngresoDescripcion').value = transaction.descripcion || '';
    document.getElementById('editIngresoFecha').value = transaction.fecha || '';
    openModal('modalEditarIngreso');
}

async function handleGuardarEdicionIngreso(event) {
    event.preventDefault();
    try {
        await adminRequest(`/api/transacciones/${encodeURIComponent(document.getElementById('editIngresoId')?.value)}`, {
            method: 'PUT',
            body: JSON.stringify({
                tipo: 'ingreso',
                monto: Number(document.getElementById('editIngresoMonto')?.value),
                categoria: document.getElementById('editIngresoFuente')?.value,
                descripcion: document.getElementById('editIngresoDescripcion')?.value,
                fecha: document.getElementById('editIngresoFecha')?.value
            })
        });
        closeModal('modalEditarIngreso');
        await loadAdminSummary();
        showToast('Ingreso actualizado correctamente');
    } catch (error) { showToast(error.message); }
}

async function eliminarIngreso(id) {
    if (!window.confirm('¿Eliminar este ingreso?')) return;
    try {
        await adminRequest(`/api/transacciones/${encodeURIComponent(id)}`, { method: 'DELETE' });
        await loadAdminSummary();
        showToast('Ingreso eliminado');
    } catch (error) { showToast(error.message); }
}

function findAdminGoal(id) {
    return (NotaireState.metas || []).find(goal => Number(goal.id) === Number(id));
}

function openModalEditarMeta(id) {
    const goal = findAdminGoal(id);
    if (!goal) return;
    document.getElementById('editMetaId').value = goal.id;
    document.getElementById('editMetaNombre').value = goal.nombre || '';
    document.getElementById('editMetaObjetivo').value = goal.objetivo || 0;
    document.getElementById('editMetaActual').value = goal.actual || 0;
    document.getElementById('editMetaFecha').value = goal.fecha || '';
    openModal('modalEditarMeta');
}

async function handleGuardarEdicionMeta(event) {
    event.preventDefault();
    try {
        await adminRequest(`/api/admin/metas/${encodeURIComponent(document.getElementById('editMetaId')?.value)}`, {
            method: 'PUT',
            body: JSON.stringify({
                nombre: document.getElementById('editMetaNombre')?.value,
                monto_objetivo: Number(document.getElementById('editMetaObjetivo')?.value),
                monto_actual: Number(document.getElementById('editMetaActual')?.value),
                fecha_limite: document.getElementById('editMetaFecha')?.value
            })
        });
        closeModal('modalEditarMeta');
        await loadAdminSummary();
        showToast('Meta actualizada correctamente');
    } catch (error) { showToast(error.message); }
}

async function eliminarMeta(id) {
    if (!window.confirm('¿Eliminar esta meta?')) return;
    try {
        await adminRequest(`/api/admin/metas/${encodeURIComponent(id)}`, { method: 'DELETE' });
        await loadAdminSummary();
        showToast('Meta eliminada');
    } catch (error) { showToast(error.message); }
}

async function deleteMeta(id) {
    return eliminarMeta(id);
}

document.addEventListener('DOMContentLoaded', () => {
    updateAdminProfile();
    loadAdminSummary();
});
