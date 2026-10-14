(function () {
    const monthNames = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];

    function createMonthlySeries(transactions, monthCount = 6, now = new Date()) {
        const months = [];
        const monthlyChanges = new Map();

        for (let offset = monthCount - 1; offset >= 0; offset -= 1) {
            const monthDate = new Date(now.getFullYear(), now.getMonth() - offset, 1);
            const key = `${monthDate.getFullYear()}-${String(monthDate.getMonth() + 1).padStart(2, '0')}`;
            months.push({ key, label: monthNames[monthDate.getMonth()] });
            monthlyChanges.set(key, 0);
        }

        transactions.forEach(transaction => {
            const key = String(transaction.fecha || '').slice(0, 7);
            if (!monthlyChanges.has(key)) return;

            const amount = Number(transaction.monto) || 0;
            const type = transaction.tipo || transaction.tipo_registro;
            monthlyChanges.set(key, monthlyChanges.get(key) + (type === 'ingreso' ? amount : -amount));
        });

        let balance = 0;
        return {
            labels: months.map(month => month.label),
            values: months.map(month => {
                balance += monthlyChanges.get(month.key);
                return balance;
            })
        };
    }

    function createMonthlyTotals(transactions, type = 'ingreso', monthCount = 6, now = new Date()) {
        const series = createMonthlySeries([], monthCount, now);
        const totals = new Map(series.labels.map(label => [label, 0]));
        const monthKeys = [];

        for (let offset = monthCount - 1; offset >= 0; offset -= 1) {
            const monthDate = new Date(now.getFullYear(), now.getMonth() - offset, 1);
            monthKeys.push(`${monthDate.getFullYear()}-${String(monthDate.getMonth() + 1).padStart(2, '0')}`);
        }

        transactions.forEach(transaction => {
            if ((transaction.tipo || transaction.tipo_registro) !== type) return;
            const index = monthKeys.indexOf(String(transaction.fecha || '').slice(0, 7));
            if (index < 0) return;
            const label = series.labels[index];
            totals.set(label, totals.get(label) + (Number(transaction.monto) || 0));
        });

        return { labels: series.labels, values: series.labels.map(label => totals.get(label)) };
    }

    const backgroundPlugin = {
        id: 'notaireFinancialChartBackground',
        beforeDraw(chart) {
            const { ctx, width, height } = chart;
            const gradient = ctx.createLinearGradient(0, 0, width, height);
            gradient.addColorStop(0, '#020b35');
            gradient.addColorStop(0.55, '#062c65');
            gradient.addColorStop(1, '#031747');

            ctx.save();
            ctx.fillStyle = gradient;
            ctx.fillRect(0, 0, width, height);
            const glow = ctx.createRadialGradient(width * 0.72, height * 0.25, 0, width * 0.72, height * 0.25, width * 0.7);
            glow.addColorStop(0, 'rgba(0, 132, 255, 0.18)');
            glow.addColorStop(1, 'rgba(0, 132, 255, 0)');
            ctx.fillStyle = glow;
            ctx.fillRect(0, 0, width, height);
            ctx.restore();
        },
        beforeDatasetDraw(chart) {
            const { ctx } = chart;
            ctx.save();
            ctx.shadowColor = 'rgba(20, 210, 205, 0.45)';
            ctx.shadowBlur = 10;
        },
        afterDatasetDraw(chart) {
            chart.ctx.restore();
        }
    };

    function createConfig(labels, values, formatValue, seriesLabel = 'Patrimonio') {
        return {
            type: 'line',
            data: {
                labels,
                datasets: [{
                    label: seriesLabel,
                    data: values,
                    borderColor: '#20d6bd',
                    borderWidth: 3,
                    backgroundColor(context) {
                        const chart = context.chart;
                        const gradient = chart.ctx.createLinearGradient(0, chart.chartArea?.top || 0, 0, chart.chartArea?.bottom || chart.height);
                        gradient.addColorStop(0, 'rgba(32, 214, 189, 0.28)');
                        gradient.addColorStop(1, 'rgba(32, 214, 189, 0)');
                        return gradient;
                    },
                    segment: {
                        borderColor: context => context.p1.parsed.y >= context.p0.parsed.y ? '#20d6bd' : '#ff5964'
                    },
                    pointBackgroundColor: context => {
                        const values = context.dataset.data;
                        const index = context.dataIndex;
                        return index === 0 || values[index] >= values[index - 1] ? '#20d6bd' : '#ff5964';
                    },
                    pointBorderColor: '#e4fbff',
                    pointBorderWidth: 1.5,
                    pointRadius: 3.5,
                    pointHoverRadius: 6,
                    pointHitRadius: 12,
                    fill: true,
                    tension: 0.35
                }]
            },
            plugins: [backgroundPlugin],
            options: {
                responsive: true,
                maintainAspectRatio: false,
                interaction: { intersect: false, mode: 'index' },
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        backgroundColor: 'rgba(2, 11, 43, 0.96)',
                        borderColor: 'rgba(83, 170, 255, 0.45)',
                        borderWidth: 1,
                        titleColor: '#d9edff',
                        bodyColor: '#ffffff',
                        displayColors: false,
                        callbacks: {
                            label: context => `${seriesLabel}: ${formatValue(context.parsed.y)}`
                        }
                    }
                },
                scales: {
                    x: {
                        grid: { display: false },
                        border: { display: false },
                        ticks: { color: 'rgba(211, 231, 255, 0.8)', maxRotation: 0 }
                    },
                    y: {
                        grid: { color: 'rgba(105, 170, 255, 0.14)' },
                        border: { display: false },
                        ticks: {
                            color: 'rgba(211, 231, 255, 0.72)',
                            maxTicksLimit: 5,
                            callback: value => {
                                const magnitude = Math.abs(Number(value));
                                const formatted = new Intl.NumberFormat('es-CO', magnitude >= 1000
                                    ? { notation: 'compact', maximumFractionDigits: 1 }
                                    : { maximumSignificantDigits: 4 }).format(value);
                                return `$${formatted}`;
                            }
                        }
                    }
                }
            }
        };
    }

    window.NotaireFinancialChart = { createMonthlySeries, createMonthlyTotals, createConfig };
})();
