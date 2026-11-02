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

export function monthDateRange(mes) {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(String(mes || ''))) {
    throw new TypeError('El mes debe tener el formato AAAA-MM');
  }
  const [year, month] = mes.split('-').map(Number);
  return {
    start: `${mes}-01`,
    endExclusive: new Date(Date.UTC(year, month, 1)).toISOString().slice(0, 10)
  };
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

export function createLiquidityTrend(transactions = [], now = new Date(), monthCount = 6) {
  const monthNames = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
  const months = [];
  const monthlyChanges = new Map();
  const [year, financialMonth] = currentFinancialMonth(now).split('-').map(Number);
  const month = financialMonth - 1;

  for (let offset = monthCount - 1; offset >= 0; offset -= 1) {
    const date = new Date(Date.UTC(year, month - offset, 1));
    const key = `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`;
    months.push({ key, label: monthNames[date.getUTCMonth()] });
    monthlyChanges.set(key, 0);
  }

  const firstMonth = months[0]?.key;
  let balance = 0;
  transactions.forEach(transaction => {
    const key = String(transaction.fecha || '').slice(0, 7);
    const type = transactionType(transaction);
    if (!['ingreso', 'gasto'].includes(type)) return;

    const amount = amountOf(transaction);
    if (monthlyChanges.has(key)) {
      monthlyChanges.set(key, monthlyChanges.get(key) + (type === 'ingreso' ? amount : -amount));
    } else if (firstMonth && key < firstMonth) {
      balance += type === 'ingreso' ? amount : -amount;
    }
  });

  return {
    labels: months.map(({ label }) => label),
    values: months.map(({ key }) => {
      balance += monthlyChanges.get(key);
      return balance;
    })
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
