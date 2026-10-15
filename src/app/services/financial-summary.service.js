const FINANCIAL_TIME_ZONE = 'America/Bogota';

export function currentFinancialMonth(now = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: FINANCIAL_TIME_ZONE,
    year: 'numeric',
    month: '2-digit'
  }).formatToParts(now);
  const year = parts.find(part => part.type === 'year')?.value;
  const month = parts.find(part => part.type === 'month')?.value;
  return `${year}-${month}`;
}

export function monthReferenceDate(mes) {
  return /^\d{4}-(0[1-9]|1[0-2])$/.test(String(mes || ''))
    ? new Date(`${mes}-15T12:00:00-05:00`)
    : new Date();
}

export function transactionType(transaction) {
  return String(transaction?.tipo || transaction?.tipo_registro || '').trim().toLowerCase();
}

function amountOf(record) {
  const amount = Number(record?.monto);
  return Number.isFinite(amount) && amount > 0 ? amount : 0;
}

// Liquidez = ingresos - gastos - fondos asignados (ahorros + metas)
// Movimiento total = ingresos + gastos (volumen transaccionado)
export function calculateBalances(ingresos, gastos, fondosAsignados = 0) {
  const fondos = Math.max(0, Number(fondosAsignados) || 0);
  const liquidez = ingresos - gastos - fondos;
  return {
    liquidez,
    totalAhorrado: fondos,
    movimientoTotal: ingresos + gastos
  };
}

export function calculateFinancialSummary(transactions = [], patrimonyRecords = [], now = new Date(), fondosAsignados = 0) {
  const validTransactions = transactions.filter(transaction => (
    ['ingreso', 'gasto'].includes(transactionType(transaction))
  ));
  const sumType = (rows, type) => rows
    .filter(transaction => transactionType(transaction) === type)
    .reduce((total, transaction) => total + amountOf(transaction), 0);
  const currentMonth = currentFinancialMonth(now);
  const monthTransactions = validTransactions.filter(transaction => (
    String(transaction.fecha || '').slice(0, 7) === currentMonth
  ));
  const ingresosAcumulados = sumType(validTransactions, 'ingreso');
  const gastosAcumulados = sumType(validTransactions, 'gasto');
  const transactionBalance = ingresosAcumulados - gastosAcumulados;

  const activos = patrimonyRecords.filter(record => (
    String(record.tipo || '').trim().toLowerCase().startsWith('activo')
  ));
  const pasivos = patrimonyRecords.filter(record => (
    String(record.tipo || '').trim().toLowerCase().startsWith('pasivo')
  ));
  const activosRegistrados = activos.reduce((total, record) => total + amountOf(record), 0);
  const pasivosRegistrados = pasivos.reduce((total, record) => total + amountOf(record), 0);

  const ingresosMes = sumType(monthTransactions, 'ingreso');
  const gastosMes = sumType(monthTransactions, 'gasto');
  const balances = calculateBalances(ingresosAcumulados, gastosAcumulados, fondosAsignados);

  return {
    ingresosMes,
    gastosMes,
    movimientoMes: ingresosMes + gastosMes,
    ingresosAcumulados,
    gastosAcumulados,
    saldoMovimientos: transactionBalance,
    totalActivos: activosRegistrados,
    totalPasivos: pasivosRegistrados,
    activosNetos: activosRegistrados - pasivosRegistrados,
    ...balances
  };
}
