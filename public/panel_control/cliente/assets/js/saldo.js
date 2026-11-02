let graficoEvolucion = null;
let chartDona = null;
let ultimoResumenSaldo = null;
let ultimaDistribucionSaldo = null;
let periodoGraficoSaldo = 'monthly';

document.addEventListener('notaire:palettechange', () => {
    actualizarColoresGraficoDona();
    if (ultimaDistribucionSaldo) actualizarLeyendaDistribucion(ultimaDistribucionSaldo);
    actualizarEstiloGraficaLiquidez();
});

document.addEventListener('notaire:languagechange', () => {
    if (!ultimoResumenSaldo) return;
    renderizarGraficoDona(ultimoResumenSaldo);
    void cargarGraficoEvolucion(ultimoResumenSaldo.evolucion);
});

document.addEventListener('click', async event => {
    const button = event.target.closest('[data-saldo-period]');
    if (!button || button.disabled) return;

    const period = button.dataset.saldoPeriod;
    if (!['monthly', 'weekly'].includes(period) || period === periodoGraficoSaldo) return;

    const buttons = [...document.querySelectorAll('[data-saldo-period]')];
    buttons.forEach(item => { item.disabled = true; });
    const status = document.getElementById('saldoTrendStatus');
    if (period === 'weekly' && status) {
        status.hidden = false;
        status.textContent = window.translateText?.('Cargando estadística semanal...') || 'Cargando estadística semanal...';
    }

    const loaded = await cargarGraficoEvolucion(ultimoResumenSaldo?.evolucion, period);
    if (loaded) {
        periodoGraficoSaldo = period;
        actualizarSelectorPeriodoSaldo(period);
        const range = document.getElementById('saldoTrendRange');
        if (range) {
            const label = period === 'weekly' ? 'Últimos 7 días' : 'Últimos 6 meses';
            range.textContent = window.translateText?.(label) || label;
        }
    }
    buttons.forEach(item => { item.disabled = false; });
});

function actualizarSelectorPeriodoSaldo(period) {
    document.querySelectorAll('[data-saldo-period]').forEach(button => {
        const isActive = button.dataset.saldoPeriod === period;
        button.classList.toggle('is-active', isActive);
        button.setAttribute('aria-pressed', String(isActive));
    });
}

async function cargarVistaSaldo() {
    const token = localStorage.getItem('notaire_token');
    if (!token) return;

    try {
        const data = await getDashboardMetrics();
        if (!data || data === ultimoResumenSaldo) return;
        ultimoResumenSaldo = data;

        const formatearMoneda = monto => new Intl.NumberFormat('es-CO', {
            style: 'currency',
            currency: 'COP',
            minimumFractionDigits: 0
        }).format(Number(monto) || 0);
        const actualizarTexto = (id, valor) => {
            const elemento = document.getElementById(id);
            if (elemento) elemento.textContent = formatearMoneda(valor);
        };

        actualizarTexto('saldo-ingresos', data.totalIngresos || 0);
        actualizarTexto('saldo-gastos', data.totalGastos || 0);
        actualizarTexto('saldo-ahorrado', data.totalAhorrado || 0);
        actualizarTexto('saldo-disponible', data.liquidez ?? data.saldoDisponible ?? 0);
        actualizarTexto('saldo-movimiento-total', data.movimientoTotal || 0);
        actualizarTexto('saldo-dona-liquidez', data.liquidez ?? data.saldoDisponible ?? 0);

        await cargarGraficoEvolucion(data.evolucion);
        renderizarGraficoDona(data);
    } catch (error) {
        console.error('Error al cargar la vista de saldo:', error);
    }
}

async function cargarGraficoEvolucion(evolucion, period = periodoGraficoSaldo) {
    try {
        const canvas = document.getElementById('graficoEvolucion');
        if (!canvas || typeof Chart === 'undefined' || !window.NotaireFinancialChart) return false;

        let series;
        if (period === 'weekly') {
            const transactions = await fetchTransacciones();
            if (!Array.isArray(transactions)) throw new Error('La respuesta de movimientos semanales no es válida');
            series = crearSerieSemanal(transactions);
        } else {
            series = evolucion?.labels && evolucion?.values
                ? evolucion
                : window.NotaireFinancialChart.createMonthlySeries(await fetchTransacciones());
        }
        const formatValue = value => new Intl.NumberFormat('es-CO', {
            style: 'currency',
            currency: 'COP',
            maximumFractionDigits: 0
        }).format(Number(value) || 0);
        const seriesLabel = window.translateText?.('Liquidez') || 'Liquidez';

        if (graficoEvolucion) {
            graficoEvolucion.data.labels = series.labels;
            graficoEvolucion.data.datasets[0].data = series.values;
            graficoEvolucion.data.datasets[0].label = seriesLabel;
            graficoEvolucion.update('none');
        } else {
            graficoEvolucion = new Chart(
                canvas.getContext('2d'),
                crearConfiguracionGraficaSaldo(
                    series.labels,
                    series.values,
                    formatValue,
                    seriesLabel
                )
            );
        }
        const status = document.getElementById('saldoTrendStatus');
        if (status) {
            status.hidden = true;
            status.textContent = '';
        }
        return true;
    } catch (error) {
        console.error('Error cargando gráfica de evolución:', error);
        const status = document.getElementById('saldoTrendStatus');
        if (status && period === 'weekly') {
            const message = 'No se pudo cargar la estadística semanal. Intenta de nuevo.';
            status.textContent = window.translateText?.(message) || message;
            status.hidden = false;
        }
        return false;
    }
}

function crearConfiguracionGraficaSaldo(labels, values, formatValue, seriesLabel) {
    const config = window.NotaireFinancialChart.createConfig(labels, values, formatValue, seriesLabel);
    const styles = getComputedStyle(document.documentElement);
    const accentRgb = styles.getPropertyValue('--color-secondary-rgb').trim() || '162, 37, 245';
    const accent = styles.getPropertyValue('--color-secondary-light').trim() || '#d8b4fe';
    const primaryRgb = styles.getPropertyValue('--color-primary-rgb').trim() || '140, 0, 255';
    const cardBackground = styles.getPropertyValue('--color-card-bg').trim() || '#211541';
    const textMain = styles.getPropertyValue('--color-text-main').trim() || '#ffffff';
    const textMuted = styles.getPropertyValue('--color-text-muted').trim() || 'rgba(255, 255, 255, .68)';
    const expense = styles.getPropertyValue('--color-accent-red').trim() || '#fb7185';
    const dataset = config.data.datasets[0];

    config.plugins = (config.plugins || []).filter(plugin => plugin.id !== 'notaireFinancialChartBackground');
    dataset.borderColor = accent;
    dataset.borderWidth = 2.5;
    dataset.backgroundColor = context => {
        const chart = context.chart;
        const gradient = chart.ctx.createLinearGradient(0, chart.chartArea?.top || 0, 0, chart.chartArea?.bottom || chart.height);
        gradient.addColorStop(0, `rgba(${accentRgb}, .2)`);
        gradient.addColorStop(1, `rgba(${accentRgb}, 0)`);
        return gradient;
    };
    dataset.segment.borderColor = context => context.p1.parsed.y >= context.p0.parsed.y ? accent : expense;
    dataset.pointBackgroundColor = accent;
    dataset.pointBorderColor = cardBackground;
    dataset.pointBorderWidth = 2.5;
    dataset.pointRadius = 3;
    dataset.pointHoverRadius = 5;
    dataset.pointHitRadius = 12;

    config.options.plugins.tooltip.backgroundColor = cardBackground;
    config.options.plugins.tooltip.borderColor = `rgba(${primaryRgb}, .42)`;
    config.options.plugins.tooltip.titleColor = textMain;
    config.options.plugins.tooltip.bodyColor = textMuted;
    config.options.scales.x.ticks.color = textMuted;
    config.options.scales.y.grid.color = `rgba(${primaryRgb}, .12)`;
    config.options.scales.y.ticks.color = textMuted;

    return config;
}

function actualizarEstiloGraficaLiquidez() {
    if (!graficoEvolucion) return;
    const config = crearConfiguracionGraficaSaldo(
        graficoEvolucion.data.labels,
        graficoEvolucion.data.datasets[0].data,
        value => new Intl.NumberFormat('es-CO', {
            style: 'currency',
            currency: 'COP',
            maximumFractionDigits: 0
        }).format(Number(value) || 0),
        graficoEvolucion.data.datasets[0].label
    );
    graficoEvolucion.data.datasets[0] = config.data.datasets[0];
    graficoEvolucion.options = config.options;
    graficoEvolucion.update('none');
}

function crearSerieSemanal(transactions, now = new Date()) {
    const dateKey = date => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
    const end = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const dates = Array.from({ length: 7 }, (_, index) => {
        const date = new Date(end);
        date.setDate(end.getDate() - (6 - index));
        return date;
    });
    const firstDay = dateKey(dates[0]);
    const lastDay = dateKey(dates[6]);
    const dailyChanges = new Map(dates.map(date => [dateKey(date), 0]));
    let balance = 0;

    transactions.forEach(transaction => {
        const date = String(transaction.fecha || '').slice(0, 10);
        const type = window.NotaireFinancialChart.getTransactionType(transaction);
        if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !['ingreso', 'gasto'].includes(type)) return;
        const transactionAmount = Number(transaction.monto);
        const amount = Number.isFinite(transactionAmount) && transactionAmount > 0 ? transactionAmount : 0;
        if (date < firstDay) {
            balance += type === 'ingreso' ? amount : -amount;
        } else if (date <= lastDay) {
            dailyChanges.set(date, dailyChanges.get(date) + (type === 'ingreso' ? amount : -amount));
        }
    });

    const locale = window.getCurrentLang?.() === 'en' ? 'en-US' : 'es-CO';
    const formatter = new Intl.DateTimeFormat(locale, { weekday: 'short', day: 'numeric' });
    const labels = [];
    const values = [];
    dates.forEach(date => {
        const key = dateKey(date);
        balance += dailyChanges.get(key);
        labels.push(formatter.format(date));
        values.push(balance);
    });

    return { labels, values };
}

function renderizarGraficoDona(data) {
    const canvas = document.getElementById('graficoSaldoDona');
    if (!canvas || typeof Chart === 'undefined') return;

    const distribution = window.NotaireFinancialChart
        ? window.NotaireFinancialChart.calculateFinancialDistribution(
            data.totalIngresos,
            data.totalGastos,
            data.totalAhorrado
        )
        : {
            labels: ['Gastos', 'Ahorros', 'Disponible'],
            values: [
                Number(data.totalGastos) || 0,
                Number(data.totalAhorrado) || 0,
                Math.max(0, Number(data.saldoDisponible) || 0)
            ]
        };
    ultimaDistribucionSaldo = distribution;
    actualizarLeyendaDistribucion(distribution);

    const chartData = {
        labels: distribution.labels.map(label => window.translateText?.(label) || label),
        datasets: [{
            data: distribution.values,
            backgroundColor: getColoresDistribucion(),
            borderColor: getComputedStyle(document.documentElement).getPropertyValue('--color-card-bg').trim(),
            borderWidth: 3,
            borderRadius: 8,
            spacing: 4,
            hoverOffset: 7
        }]
    };
    const options = {
        responsive: true,
        maintainAspectRatio: false,
        cutout: '76%',
        animation: { duration: 450 },
        plugins: {
            legend: { display: false },
            tooltip: {
                backgroundColor: getComputedStyle(document.documentElement).getPropertyValue('--color-card-bg').trim() || 'rgba(7, 17, 32, 0.96)',
                borderColor: getComputedStyle(document.documentElement).getPropertyValue('--color-card-border').trim() || 'rgba(148, 163, 184, 0.28)',
                borderWidth: 1,
                padding: 12,
                callbacks: {
                    label: context => ` ${context.label}: ${new Intl.NumberFormat('es-CO', {
                        style: 'currency',
                        currency: 'COP',
                        maximumFractionDigits: 0
                    }).format(Number(context.raw) || 0)}`
                }
            }
        }
    };

    if (chartDona) {
        chartDona.data = chartData;
        chartDona.options = options;
        chartDona.update();
    } else {
        chartDona = new Chart(canvas.getContext('2d'), { type: 'doughnut', data: chartData, options });
    }
}

function actualizarColoresGraficoDona() {
    if (!chartDona) return;
    chartDona.data.datasets[0].backgroundColor = getColoresDistribucion();
    chartDona.data.datasets[0].borderColor = getComputedStyle(document.documentElement).getPropertyValue('--color-card-bg').trim();
    chartDona.update('none');
}

function getColoresDistribucion() {
    const styles = getComputedStyle(document.documentElement);
    return [
        styles.getPropertyValue('--color-accent-red').trim() || '#fb7185',
        styles.getPropertyValue('--color-secondary').trim() || '#a225f5',
        '#60a5fa'
    ];
}

function actualizarLeyendaDistribucion(distribution) {
    const legend = document.getElementById('saldoDonaLegend');
    if (!legend) return;

    const colors = getColoresDistribucion();
    const total = distribution.values.reduce((sum, value) => sum + Math.max(0, Number(value) || 0), 0);
    const formatCurrency = value => new Intl.NumberFormat('es-CO', {
        style: 'currency',
        currency: 'COP',
        maximumFractionDigits: 0
    }).format(Number(value) || 0);

    legend.innerHTML = distribution.labels.map((label, index) => {
        const amount = Math.max(0, Number(distribution.values[index]) || 0);
        const percent = total ? Math.round((amount / total) * 100) : 0;
        return `<div class="saldo-legend-item">
            <span class="saldo-legend-label"><i style="--saldo-legend-color:${colors[index]}"></i>${window.translateText?.(label) || label}<small>${percent}%</small></span>
            <strong>${formatCurrency(amount)}</strong>
        </div>`;
    }).join('');
}
