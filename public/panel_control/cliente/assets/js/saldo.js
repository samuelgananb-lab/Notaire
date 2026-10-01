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
        const response = await fetch(SALDO_API_URL, {
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
        actualizarTexto('saldo-disponible', data.saldoDisponible || 0);

        cargarGraficoEvolucion();
        renderizarGraficoDona(
            data.totalGastos || 0,
            data.totalAhorrado || 0,
            Math.max(0, data.saldoDisponible || 0)
        );
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
        const mesesNombres = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
        const hoy = new Date();
        const etiquetasMeses = [];
        const datosMeses = {};

        for (let i = 5; i >= 0; i--) {
            const fechaMes = new Date(hoy.getFullYear(), hoy.getMonth() - i, 1);
            const clave = `${fechaMes.getFullYear()}-${String(fechaMes.getMonth() + 1).padStart(2, '0')}`;

            etiquetasMeses.push(mesesNombres[fechaMes.getMonth()]);
            datosMeses[clave] = 0;
        }

        transacciones
            .sort((a, b) => new Date(a.fecha) - new Date(b.fecha))
            .forEach(transaccion => {
                const fechaTransaccion = new Date(transaccion.fecha);
                const clave = `${fechaTransaccion.getFullYear()}-${String(fechaTransaccion.getMonth() + 1).padStart(2, '0')}`;
                const monto = Number.parseFloat(transaccion.monto) || 0;
                const cambio = transaccion.tipo === 'ingreso' ? monto : -monto;

                if (Object.prototype.hasOwnProperty.call(datosMeses, clave)) {
                    datosMeses[clave] += cambio;
                }
            });

        let balanceAcumulado = 0;
        const valoresEvolucion = Object.values(datosMeses).map(balanceMensual => {
            balanceAcumulado += balanceMensual;
            return balanceAcumulado;
        });

        const canvas = document.getElementById('graficoEvolucion');
        if (!canvas || typeof Chart === 'undefined') return;

        graficoEvolucion?.destroy();

        graficoEvolucion = new Chart(canvas.getContext('2d'), {
            type: 'line',
            data: {
                labels: etiquetasMeses,
                datasets: [{
                    label: 'Patrimonio ($)',
                    data: valoresEvolucion,
                    borderColor: '#06b6d4',
                    backgroundColor: 'rgba(6, 182, 212, 0.1)',
                    borderWidth: 3,
                    fill: true,
                    tension: 0.4,
                    pointBackgroundColor: '#06b6d4',
                    pointRadius: 5
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { display: false } },
                scales: {
                    y: {
                        grid: { color: 'rgba(255, 255, 255, 0.05)' },
                        ticks: {
                            color: '#aaa',
                            callback: value => '$' + value.toLocaleString('es-CO')
                        }
                    },
                    x: { grid: { display: false }, ticks: { color: '#aaa' } }
                }
            }
        });
    } catch (error) {
        console.error('Error cargando gráfica de evolución:', error);
    }
}

document.addEventListener('DOMContentLoaded', cargarGraficoEvolucion);

function renderizarGraficoDona(gastos, ahorros, disponible) {
    const canvas = document.getElementById('graficoSaldoDona');
    if (!canvas || typeof Chart === 'undefined') return;

    chartDona?.destroy();

    chartDona = new Chart(canvas.getContext('2d'), {
        type: 'doughnut',
        data: {
            labels: ['Gastos', 'Ahorros', 'Disponible'],
            datasets: [{
                data: [Number(gastos) || 0, Number(ahorros) || 0, Number(disponible) || 0],
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