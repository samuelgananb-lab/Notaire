let graficoEvolucion = null;
let chartDona = null;
let ultimoResumenSaldo = null;
let ultimaDistribucionSaldo = null;

document.addEventListener('notaire:palettechange', () => {
    actualizarColoresGraficoDona();
    if (ultimaDistribucionSaldo) actualizarLeyendaDistribucion(ultimaDistribucionSaldo);
});

document.addEventListener('notaire:languagechange', () => {
    if (!ultimoResumenSaldo) return;
    renderizarGraficoDona(ultimoResumenSaldo);
    cargarGraficoEvolucion(ultimoResumenSaldo.evolucion);
});

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

async function cargarGraficoEvolucion(evolucion) {
    try {
        const canvas = document.getElementById('graficoEvolucion');
        if (!canvas || typeof Chart === 'undefined' || !window.NotaireFinancialChart) return;

        const series = evolucion?.labels && evolucion?.values
            ? evolucion
            : window.NotaireFinancialChart.createMonthlySeries(await fetchTransacciones());
        const formatValue = value => new Intl.NumberFormat('es-CO', {
            style: 'currency',
            currency: 'COP',
            maximumFractionDigits: 0
        }).format(Number(value) || 0);

        if (graficoEvolucion) {
            graficoEvolucion.data.labels = series.labels;
            graficoEvolucion.data.datasets[0].data = series.values;
            graficoEvolucion.update('none');
        } else {
            graficoEvolucion = new Chart(
                canvas.getContext('2d'),
                window.NotaireFinancialChart.createConfig(
                    series.labels,
                    series.values,
                    formatValue,
                    window.translateText?.('Patrimonio') || 'Patrimonio'
                )
            );
        }
    } catch (error) {
        console.error('Error cargando gráfica de evolución:', error);
    }
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
            backgroundColor: ['#f87171', getColorPrimario(), '#60a5fa'],
            borderColor: getComputedStyle(document.documentElement).getPropertyValue('--color-card-bg').trim(),
            borderWidth: 3,
            borderRadius: 7,
            spacing: 3,
            hoverOffset: 8
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
                backgroundColor: 'rgba(7, 17, 32, 0.96)',
                borderColor: 'rgba(148, 163, 184, 0.28)',
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

function getColorPrimario() {
    return getComputedStyle(document.documentElement).getPropertyValue('--color-primary').trim();
}

function actualizarColoresGraficoDona() {
    if (!chartDona) return;
    chartDona.data.datasets[0].backgroundColor = ['#f87171', getColorPrimario(), '#60a5fa'];
    chartDona.data.datasets[0].borderColor = getComputedStyle(document.documentElement).getPropertyValue('--color-card-bg').trim();
    chartDona.update('none');
}

function actualizarLeyendaDistribucion(distribution) {
    const legend = document.getElementById('saldoDonaLegend');
    if (!legend) return;

    const colors = ['#f87171', getColorPrimario(), '#60a5fa'];
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
