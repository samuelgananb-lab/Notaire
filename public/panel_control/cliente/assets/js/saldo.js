const SALDO_API_URL = '/api/transacciones/resumen-saldo';
let graficoEvolucion = null;
let chartDona = null;

document.addEventListener('DOMContentLoaded', () => {
    const btnSaldo = document.querySelector('#sidebarMenu a[data-target="view-saldo"]');
    btnSaldo?.addEventListener('click', () => {
        const seccionSaldo = document.getElementById('seccion-saldo');
        if (seccionSaldo) seccionSaldo.style.display = 'block';
        cargarVistaSaldo();
    });
});

async function cargarVistaSaldo() {
    const token = localStorage.getItem('notaire_token');
    if (!token) return;

    try {
        const response = await fetch(SALDO_API_URL + (window.NotaireFinancialChart?.monthQuery() || ''), {
            headers: { Authorization: `Bearer ${token}` }
        });
        if (!response.ok) throw new Error('Error al obtener el resumen de saldo');

        const data = await response.json();
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

        cargarGraficoEvolucion();
        renderizarGraficoDona(data);
    } catch (error) {
        console.error('Error al cargar la vista de saldo:', error);
    }
}

async function cargarGraficoEvolucion() {
    try {
        const token = localStorage.getItem('notaire_token');
        const response = await fetch('/api/transacciones', {
            headers: { Authorization: `Bearer ${token}` }
        });

        if (!response.ok) throw new Error('Error al obtener transacciones');
        const transacciones = await response.json();
        const canvas = document.getElementById('graficoEvolucion');
        if (!canvas || typeof Chart === 'undefined' || !window.NotaireFinancialChart) return;

        graficoEvolucion?.destroy();

        const series = window.NotaireFinancialChart.createMonthlySeries(transacciones);
        const formatValue = value => new Intl.NumberFormat('es-CO', {
            style: 'currency',
            currency: 'COP',
            maximumFractionDigits: 0
        }).format(Number(value) || 0);
        graficoEvolucion = new Chart(
            canvas.getContext('2d'),
            window.NotaireFinancialChart.createConfig(series.labels, series.values, formatValue)
        );
    } catch (error) {
        console.error('Error cargando gráfica de evolución:', error);
    }
}

document.addEventListener('DOMContentLoaded', cargarGraficoEvolucion);

function renderizarGraficoDona(data) {
    const canvas = document.getElementById('graficoSaldoDona');
    if (!canvas || typeof Chart === 'undefined') return;

    chartDona?.destroy();
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

    chartDona = new Chart(canvas.getContext('2d'), {
        type: 'doughnut',
        data: {
            labels: distribution.labels,
            datasets: [{
                data: distribution.values,
                backgroundColor: ['#ef4444', '#a855f7', '#3b82f6'],
                borderWidth: 0
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            cutout: '75%',
            plugins: {
                legend: {
                    position: 'bottom',
                    labels: {
                        color: '#aaa',
                        font: { size: 12 },
                        padding: 12
                    }
                }
            }
        }
    });
}