import { Router } from 'express';
import { currentExchangeRateDate, getExchangeRate, getSupportedCurrencies, isValidExchangeRateDate } from '../services/exchange-rate.service.js';

const router = Router();
const cache = new Map();
const CACHE_DURATION_MS = 15 * 60 * 1000;

async function withCache(key, load, res, forceRefresh = false) {
  const cached = cache.get(key);
  if (!forceRefresh && cached && cached.expiresAt > Date.now()) {
    res.set('Cache-Control', 'private, max-age=900');
    return cached.value;
  }
  const value = await load();
  for (const [cacheKey, entry] of cache) {
    if (entry.expiresAt <= Date.now()) cache.delete(cacheKey);
  }
  if (cache.size >= 400 && !cache.has(key)) cache.delete(cache.keys().next().value);
  cache.set(key, { value, expiresAt: Date.now() + CACHE_DURATION_MS });
  res.set('Cache-Control', 'private, max-age=900');
  return value;
}

router.get('/currencies', async (_req, res) => {
  try {
    const currencies = await withCache('currencies', getSupportedCurrencies, res);
    res.json({ currencies });
  } catch (error) {
    console.error('No se pudo consultar el catálogo de monedas:', error.message);
    res.status(502).json({ error: 'No se pudo cargar el catálogo de monedas.' });
  }
});

router.get('/rate', async (req, res) => {
  const base = String(req.query.base || '').toUpperCase();
  const quote = String(req.query.quote || '').toUpperCase();
  const date = String(req.query.date || currentExchangeRateDate());
  if (!/^[A-Z]{3}$/.test(base) || !/^[A-Z]{3}$/.test(quote)) {
    return res.status(400).json({ error: 'Indica dos códigos de moneda válidos.' });
  }
  if (!isValidExchangeRateDate(date)) {
    return res.status(400).json({ error: 'Indica una fecha de cotización válida.' });
  }
  try {
    const key = `rate:${base}:${quote}:${date}`;
    const rate = await withCache(key, () => getExchangeRate(base, quote, globalThis.fetch, date), res, req.query.refresh === '1');
    res.json(rate);
  } catch (error) {
    console.error(`No se pudo consultar la tasa ${base}/${quote}:`, error.message);
    res.status(502).json({ error: 'No se pudo consultar la tasa de cambio. Intenta de nuevo más tarde.' });
  }
});

export default router;
