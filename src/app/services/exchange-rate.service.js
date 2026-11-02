const FRANKFURTER_API = 'https://api.frankfurter.dev/v2';
const CURRENCY_ORDER = ['COP', 'USD', 'EUR', 'GBP', 'JPY', 'CNY', 'CHF', 'CAD', 'AUD', 'NZD', 'MXN', 'BRL', 'INR', 'KRW', 'SGD', 'HKD', 'SEK', 'NOK', 'DKK', 'PLN', 'AED', 'SAR', 'ZAR'];

export function normalizeCurrencyCatalog(currencies, now = new Date()) {
  if (!Array.isArray(currencies)) throw new TypeError('La respuesta de monedas no es válida');
  const priority = new Map(CURRENCY_ORDER.map((code, index) => [code, index]));
  const latestCurrencyDate = new Date(now);
  latestCurrencyDate.setUTCDate(latestCurrencyDate.getUTCDate() - 7);
  const activeSince = latestCurrencyDate.toISOString().slice(0, 10);
  return currencies
    .filter(currency =>
      /^[A-Z]{3}$/.test(currency?.iso_code || '') &&
      /^\d{3}$/.test(currency?.iso_numeric || '') &&
      currency?.name &&
      (!currency.end_date || currency.end_date >= activeSince)
    )
    .map(currency => ({
      code: currency.iso_code,
      name: currency.name,
      symbol: currency.symbol || currency.iso_code
    }))
    .sort((left, right) =>
      (priority.get(left.code) ?? Number.MAX_SAFE_INTEGER) - (priority.get(right.code) ?? Number.MAX_SAFE_INTEGER) ||
      left.name.localeCompare(right.name)
    );
}

export function currentExchangeRateDate(now = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Bogota',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).formatToParts(now);
  const year = parts.find(part => part.type === 'year')?.value;
  const month = parts.find(part => part.type === 'month')?.value;
  const day = parts.find(part => part.type === 'day')?.value;
  return `${year}-${month}-${day}`;
}

export function isValidExchangeRateDate(date) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return false;
  const parsed = new Date(`${date}T00:00:00Z`);
  return !Number.isNaN(parsed.getTime()) &&
    parsed.toISOString().slice(0, 10) === date &&
    date <= currentExchangeRateDate();
}

async function fetchFrankfurter(path, fetcher = globalThis.fetch) {
  const response = await fetcher(`${FRANKFURTER_API}${path}`, {
    headers: { Accept: 'application/json' },
    signal: AbortSignal.timeout(8000)
  });
  if (!response.ok) throw new Error(`El servicio de tasas respondió HTTP ${response.status}`);
  return response.json();
}

export async function getSupportedCurrencies(fetcher = globalThis.fetch) {
  return normalizeCurrencyCatalog(await fetchFrankfurter('/currencies', fetcher));
}

export async function getExchangeRate(base, quote, fetcher = globalThis.fetch, date = currentExchangeRateDate()) {
  if (!/^[A-Z]{3}$/.test(base) || !/^[A-Z]{3}$/.test(quote)) {
    throw new TypeError('Los códigos de moneda no son válidos');
  }
  if (!isValidExchangeRateDate(date)) {
    throw new TypeError('La fecha de cotización no es válida');
  }
  if (base === quote) return { base, quote, rate: 1, date };
  const query = new URLSearchParams({ date });
  const result = await fetchFrankfurter(`/rate/${encodeURIComponent(base)}/${encodeURIComponent(quote)}?${query}`, fetcher);
  if (result?.base !== base || result?.quote !== quote || !Number.isFinite(result.rate) || result.rate <= 0) {
    throw new Error('El servicio de tasas devolvió una cotización no válida');
  }
  return { base, quote, rate: result.rate, date: result.date };
}
