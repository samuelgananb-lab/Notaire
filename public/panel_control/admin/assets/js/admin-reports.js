const ADMIN_REPORTS_URL = '/api/admin/reports';
let adminReportData = null;

function escapeReport(value) {
    return String(value ?? '').replace(/[&<>"']/g, character => ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;'
    }[character]));
}

function reportCurrency(value) {
    return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(Number(value) || 0);
}

function renderReportRows(containerId, rows, formatter) {
    const container = document.getElementById(containerId);
    if (!container) return;
    container.innerHTML = rows.length ? rows.map(formatter).join('') : '<p class="admin-users-state">Sin datos para este periodo.</p>';
}

function renderAdminReport(data) {
    adminReportData = data;
    document.getElementById('reportIncome').textContent = reportCurrency(data.kpis?.ingresos);
    document.getElementById('reportExpense').textContent = reportCurrency(data.kpis?.gastos);
    document.getElementById('reportBalance').textContent = reportCurrency(data.kpis?.balance);
    document.getElementById('reportTramites').textContent = data.kpis?.tramites || 0;

    renderReportRows('reportExpensesByCategory', data.gastosPorCategoria || [], row => `
        <div class="admin-report-row"><span>${escapeReport(row.label)}</span><strong>${reportCurrency(row.total)}</strong></div>
    `);
    renderReportRows('reportTramitesByStatus', data.tramitesPorEstado || [], row => `
        <div class="admin-report-row"><span>${escapeReport(row.label)}</span><strong>${row.total}</strong></div>
    `);
    renderReportRows('reportMonthly', data.mensual || [], row => `
        <div class="admin-report-row"><span>${escapeReport(row.mes)}</span><span>Ingresos: <strong>${reportCurrency(row.ingresos)}</strong> · Gastos: <strong>${reportCurrency(row.gastos)}</strong></span></div>
    `);
}

async function loadAdminReport() {
    const token = localStorage.getItem('notaire_token');
    if (!token) return;
    const params = new URLSearchParams();
    const from = document.getElementById('reportFrom')?.value;
    const to = document.getElementById('reportTo')?.value;
    if (from) params.set('from', from);
    if (to) params.set('to', to);

    try {
        const response = await fetch(`${ADMIN_REPORTS_URL}?${params}`, { headers: { Authorization: `Bearer ${token}` } });
        const result = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(result.detalle || result.error || 'No se pudo generar el reporte');
        renderAdminReport(result);
    } catch (error) {
        ['reportIncome', 'reportExpense', 'reportBalance', 'reportTramites'].forEach(id => {
            const element = document.getElementById(id);
            if (element) element.textContent = 'No disponible';
        });
    }
}

function exportAdminReport() {
    if (!adminReportData) return;
    const rows = [
        ['Indicador', 'Valor'],
        ['Ingresos', adminReportData.kpis.ingresos],
        ['Gastos', adminReportData.kpis.gastos],
        ['Balance', adminReportData.kpis.balance],
        ['Trámites', adminReportData.kpis.tramites],
        [],
        ['Mes', 'Ingresos', 'Gastos'],
        ...(adminReportData.mensual || []).map(row => [row.mes, row.ingresos, row.gastos])
    ];
    const csv = rows.map(row => row.map(value => `"${String(value ?? '').replace(/"/g, '""')}"`).join(',')).join('\n');
    const link = document.createElement('a');
    link.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8;' }));
    link.download = `notaire-reporte-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(link.href);
}

document.addEventListener('DOMContentLoaded', () => {
    loadAdminReport();
    document.getElementById('btnLoadReport')?.addEventListener('click', loadAdminReport);
    document.getElementById('btnExportReport')?.addEventListener('click', exportAdminReport);
    document.querySelector('#sidebarMenu a[data-target="view-reportes"]')?.addEventListener('click', loadAdminReport);
});
