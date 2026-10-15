import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import vm from 'node:vm';
import {
    calculateFinancialSummary,
    currentFinancialMonth
} from '../src/app/services/financial-summary.service.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

test('el resumen separa ingresos y gastos del mes y conserva el saldo acumulado', () => {
    const now = new Date('2026-10-14T17:00:00.000Z');
    const transactions = [
        { tipo: 'ingreso', monto: 11000000, fecha: '2026-04-01' },
        { tipo: 'gasto', monto: 10000000, fecha: '2026-09-01' },
        { tipo: 'gasto', monto: 3000000, fecha: '2026-10-02', categoria: 'Arriendo' },
        { tipo: 'gasto', monto: 1570000, fecha: '2026-10-04', categoria: 'Alimentación' },
        { tipo: 'gasto', monto: 1500000, fecha: '2026-10-06', categoria: 'Servicios' }
    ];

    const summary = calculateFinancialSummary(transactions, [], now);
    assert.equal(summary.ingresosMes, 0);
    assert.equal(summary.gastosMes, 6070000);
    assert.equal(summary.saldoMovimientos, -5070000);
    assert.equal(summary.liquidez, -5070000);
    assert.equal(summary.movimientoTotal, 11000000 + 10000000 + 3000000 + 1570000 + 1500000);
    assert.equal(summary.movimientoMes, 6070000);
    assert.equal(summary.totalActivos, 0);
    assert.equal(summary.totalPasivos, 0);
});

test('liquidez descuenta ahorros y metas', () => {
    const now = new Date('2026-10-14T17:00:00.000Z');
    const summary = calculateFinancialSummary([
        { tipo: 'ingreso', monto: 2350000, fecha: '2026-10-01' },
        { tipo: 'gasto', monto: 1150000, fecha: '2026-10-02' }
    ], [], now, 300000);

    assert.equal(summary.liquidez, 900000);
    assert.equal(summary.totalAhorrado, 300000);
    assert.equal(summary.movimientoTotal, 3500000);
    assert.equal('patrimonio' in summary, false);
    assert.equal(summary.movimientoMes, 3500000);
});

test('un gasto baja la liquidez; un ahorro solo la reparte hacia metas', () => {
    const now = new Date('2026-10-14T17:00:00.000Z');
    const base = [{ tipo: 'ingreso', monto: 1000000, fecha: '2026-10-01' }];
    const conAhorro = calculateFinancialSummary(base, [], now, 400000);
    const conGasto = calculateFinancialSummary([...base, { tipo: 'gasto', monto: 100000, fecha: '2026-10-02' }], [], now, 400000);

    assert.equal(conAhorro.liquidez, 600000);
    assert.equal(conGasto.liquidez, 500000);
});

test('los ingresos y gastos mueven la liquidez de forma coherente', () => {
    const now = new Date('2026-10-14T17:00:00.000Z');
    const before = calculateFinancialSummary([
        { tipo: 'ingreso', monto: 11000000, fecha: '2026-10-01' }
    ], [], now);
    const after = calculateFinancialSummary([
        { tipo: 'ingreso', monto: 11000000, fecha: '2026-10-01' },
        { tipo: 'gasto', monto: 10000000, fecha: '2026-10-02' }
    ], [], now);

    assert.equal(before.liquidez, 11000000);
    assert.equal(after.liquidez, 1000000);
    assert.equal(after.liquidez, 1000000);
});

test('los activos y pasivos registrados se informan aparte', () => {
    const summary = calculateFinancialSummary(
        [{ tipo: 'ingreso', monto: 11000000, fecha: '2026-10-01' }],
        [
            { tipo: 'activo', monto: 20000000 },
            { tipo: 'pasivo', monto: 7000000 }
        ],
        new Date('2026-10-14T17:00:00.000Z')
    );

    assert.equal(summary.totalActivos, 20000000);
    assert.equal(summary.totalPasivos, 7000000);
    assert.equal(summary.activosNetos, 13000000);
});

test('el mes financiero usa la fecha local de Colombia', () => {
    assert.equal(currentFinancialMonth(new Date('2026-10-01T02:00:00.000Z')), '2026-09');
});

test('las categorías y la evolución del panel usan tipos y periodos coherentes', async () => {
    const source = await readFile(
        path.join(root, 'public/panel_control/assets/js/financial-chart.js'),
        'utf8'
    );
    const clientSaldo = await readFile(
        path.join(root, 'public/panel_control/cliente/assets/js/saldo.js'),
        'utf8'
    );
    const employeePanel = await readFile(
        path.join(root, 'public/panel_control/admin/assets/js/admin-live.js'),
        'utf8'
    );
    const adminRoute = await readFile(
        path.join(root, 'src/app/routes/admin.routes.js'),
        'utf8'
    );
    const context = { window: {}, Intl, Date, Map, String, Number, Math };
    vm.runInNewContext(source, context);

    const transactions = [
        { tipo: 'ingreso', monto: 11000000, fecha: '2026-10-01', categoria: 'Salario' },
        { tipo: 'gasto', monto: 10000000, fecha: '2026-09-01', categoria: 'Pago' },
        { tipo: 'gasto', monto: 3000000, fecha: '2026-10-02', categoria: 'Arriendo' },
        { tipo: 'gasto', monto: 1570000, fecha: '2026-10-04', categoria: 'Alimentación' },
        { tipo: 'gasto', monto: 1500000, fecha: '2026-10-06', categoria: 'Servicios' }
    ];
    const charts = context.window.NotaireFinancialChart;
    const month = charts.filterTransactionsByMonth(transactions, '2026-10');
    const expenses = charts.aggregateByCategory(month, 'gasto');
    const expenseTotal = expenses.reduce((sum, [, amount]) => sum + amount, 0);
    const series = charts.createMonthlySeries(transactions, 6, new Date('2026-10-14T17:00:00.000Z'));
    const distribution = charts.calculateFinancialDistribution(11000000, 15070000, 0);

    assert.equal(expenses.some(([category]) => category === 'Salario'), false);
    assert.equal(expenseTotal, 6070000);
    assert.equal(series.values.at(-1), -5070000);
    assert.deepEqual(Array.from(distribution.values), [15070000, 0, 0]);
    assert.deepEqual(Array.from(distribution.labels), ['Gastos', 'Ahorros', 'Disponible']);
    assert.equal(distribution.available, -4070000);
    assert.match(clientSaldo, /calculateFinancialDistribution/);
    assert.match(employeePanel, /calculateFinancialDistribution/);
    assert.match(adminRoute, /saldoDisponible/);
    assert.doesNotMatch(adminRoute, /Saldo neto de movimientos/);

    const overBudget = charts.calculateBudgetPosition(5000000, expenseTotal);
    assert.equal(overBudget.available, -1070000);
    assert.ok(Math.abs(overBudget.percentUsed - 121.4) < Number.EPSILON * 1024);
    assert.equal(charts.calculateBudgetPosition(0, expenseTotal).percentUsed, null);
});
