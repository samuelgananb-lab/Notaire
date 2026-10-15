(function () {
    const monthNames = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];

    const realCurrentMonthKey = (now = new Date()) => {
        const parts = new Intl.DateTimeFormat('en-CA', {
            timeZone: 'America/Bogota',
            year: 'numeric',
            month: '2-digit'
        }).formatToParts(now);
        const year = parts.find(part => part.type === 'year')?.value;
        const month = parts.find(part => part.type === 'month')?.value;
        return `${year}-${month}`;
    };

    const SELECTED_MONTH_STORAGE = 'notaire_selected_month';

    function selectedMonthKey() {
        let stored = null;
        try { stored = localStorage.getItem(SELECTED_MONTH_STORAGE); } catch (error) { /* sin storage */ }
        return /^\d{4}-(0[1-9]|1[0-2])$/.test(stored || '') ? stored : null;
    }

    function setSelectedMonth(monthKey) {
        try {
            if (/^\d{4}-(0[1-9]|1[0-2])$/.test(monthKey || '') && monthKey !== realCurrentMonthKey()) {
                localStorage.setItem(SELECTED_MONTH_STORAGE, monthKey);
            } else {
                localStorage.removeItem(SELECTED_MONTH_STORAGE);
            }
        } catch (error) { /* sin storage */ }
    }

    function monthQuery(prefix = '?') {
        const key = selectedMonthKey();
        return key ? `${prefix}mes=${key}` : '';
    }

    function currentMonthKey(now) {
        if (now === undefined) {
            const selected = selectedMonthKey();
            if (selected) return selected;
        }
        return realCurrentMonthKey(now);
    }

    function getTransactionType(transaction) {
        return String(transaction.tipo || transaction.tipo_registro || '').trim().toLowerCase();
    }

    function getTransactionAmount(transaction) {
        const amount = Number(transaction.monto);
        return Number.isFinite(amount) && amount > 0 ? amount : 0;
    }

    function filterTransactionsByMonth(transactions, monthKey = currentMonthKey()) {
        return (transactions || []).filter(transaction => (
            String(transaction.fecha || '').slice(0, 7) === monthKey
        ));
    }

    function aggregateByCategory(transactions, type) {
        const totals = new Map();
        (transactions || []).forEach(transaction => {
            if (type && getTransactionType(transaction) !== type) return;
            const category = String(transaction.categoria || '').trim() || 'Otros';
            totals.set(category, (totals.get(category) || 0) + getTransactionAmount(transaction));
        });
        return [...totals.entries()].sort((a, b) => b[1] - a[1]);
    }

    function calculateBudgetPosition(budget, expenses) {
        const budgetAmount = Number(budget);
        const expenseAmount = Number(expenses);
        const hasBudget = Number.isFinite(budgetAmount) && budgetAmount > 0;
        const validExpenses = Number.isFinite(expenseAmount) ? expenseAmount : 0;
        return {
            hasBudget,
            available: hasBudget ? budgetAmount - validExpenses : null,
            percentUsed: hasBudget ? (validExpenses / budgetAmount) * 100 : null
        };
    }

    function calculateFinancialDistribution(income, expenses, savings) {
        const amount = value => {
            const number = Number(value);
            return Number.isFinite(number) ? number : 0;
        };
        const totalIncome = amount(income);
        const totalExpenses = amount(expenses);
        const totalSavings = amount(savings);
        const available = totalIncome - totalExpenses - totalSavings;
        return {
            labels: ['Gastos', 'Ahorros', 'Disponible'],
            values: [totalExpenses, totalSavings, Math.max(0, available)],
            available
        };
    }

    function referenceDate() {
        const selected = selectedMonthKey();
        return selected ? new Date(Number(selected.slice(0, 4)), Number(selected.slice(5, 7)) - 1, 1) : new Date();
    }

    function createMonthlySeries(transactions, monthCount = 6, now = referenceDate()) {
        const months = [];
        const monthlyChanges = new Map();

        for (let offset = monthCount - 1; offset >= 0; offset -= 1) {
            const monthDate = new Date(now.getFullYear(), now.getMonth() - offset, 1);
            const key = `${monthDate.getFullYear()}-${String(monthDate.getMonth() + 1).padStart(2, '0')}`;
            months.push({ key, label: monthNames[monthDate.getMonth()] });
            monthlyChanges.set(key, 0);
        }

        const firstMonth = months[0]?.key;
        let balance = 0;
        transactions.forEach(transaction => {
            const key = String(transaction.fecha || '').slice(0, 7);
            const type = getTransactionType(transaction);
            if (!['ingreso', 'gasto'].includes(type)) return;
            const amount = getTransactionAmount(transaction);
            if (monthlyChanges.has(key)) {
                monthlyChanges.set(key, monthlyChanges.get(key) + (type === 'ingreso' ? amount : -amount));
            } else if (firstMonth && key < firstMonth) {
                balance += type === 'ingreso' ? amount : -amount;
            }
        });

        return {
            labels: months.map(month => month.label),
            values: months.map(month => {
                balance += monthlyChanges.get(month.key);
                return balance;
            })
        };
    }

    function createMonthlyTotals(transactions, type = 'ingreso', monthCount = 6, now = referenceDate()) {
        const series = createMonthlySeries([], monthCount, now);
        const totals = new Map(series.labels.map(label => [label, 0]));
        const monthKeys = [];

        for (let offset = monthCount - 1; offset >= 0; offset -= 1) {
            const monthDate = new Date(now.getFullYear(), now.getMonth() - offset, 1);
            monthKeys.push(`${monthDate.getFullYear()}-${String(monthDate.getMonth() + 1).padStart(2, '0')}`);
        }

        transactions.forEach(transaction => {
            if (getTransactionType(transaction) !== type) return;
            const index = monthKeys.indexOf(String(transaction.fecha || '').slice(0, 7));
            if (index < 0) return;
            const label = series.labels[index];
            totals.set(label, totals.get(label) + getTransactionAmount(transaction));
        });

        return { labels: series.labels, values: series.labels.map(label => totals.get(label)) };
    }

    function averageMonthlyTotal(transactions, type = 'ingreso', monthCount = 6, now = referenceDate()) {
        const { values } = createMonthlyTotals(transactions, type, monthCount, now);
        return values.reduce((total, value) => total + value, 0) / (values.length || 1);
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

    window.NotaireFinancialChart = {
        currentMonthKey,
        selectedMonthKey,
        setSelectedMonth,
        monthQuery,
        filterTransactionsByMonth,
        getTransactionType,
        aggregateByCategory,
        calculateBudgetPosition,
        calculateFinancialDistribution,
        createMonthlySeries,
        createMonthlyTotals,
        averageMonthlyTotal,
        createConfig
    };
})();
