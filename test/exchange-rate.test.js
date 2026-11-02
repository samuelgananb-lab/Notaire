import test from 'node:test';
import assert from 'node:assert/strict';
import { currentExchangeRateDate, getExchangeRate, getSupportedCurrencies, isValidExchangeRateDate, normalizeCurrencyCatalog } from '../src/app/services/exchange-rate.service.js';

test('el catálogo prioriza monedas principales y excluye entradas no monetarias', () => {
    const currencies = normalizeCurrencyCatalog([
        { iso_code: 'ZZZ', iso_numeric: '999', name: 'Unknown Currency', symbol: null },
        { iso_code: 'BTC', iso_numeric: null, name: 'Bitcoin', symbol: '₿' },
        { iso_code: 'USD', iso_numeric: '840', name: 'US Dollar', symbol: '$' },
        { iso_code: 'COP', iso_numeric: '170', name: 'Colombian Peso', symbol: '$' },
        { iso_code: 'OLD', iso_numeric: '111', name: 'Old Currency', end_date: '2000-01-01' },
        { iso_code: 'bad', iso_numeric: '000', name: 'Invalid' }
    ]);

    assert.deepEqual(currencies.map(currency => currency.code), ['COP', 'USD', 'ZZZ']);
    assert.equal(currencies[2].symbol, 'ZZZ');
    assert.throws(() => normalizeCurrencyCatalog(null), /no es válida/);
});

test('consulta la lista y las tasas a través del servicio externo permitido', async () => {
    const requestedUrls = [];
    const fetcher = async url => {
        requestedUrls.push(url);
        if (url.endsWith('/currencies')) {
            return {
                ok: true,
                json: async () => [{ iso_code: 'USD', iso_numeric: '840', name: 'US Dollar', symbol: '$' }]
            };
        }
        return {
            ok: true,
            json: async () => ({ date: '2026-10-26', base: 'USD', quote: 'COP', rate: 3900.25 })
        };
    };

    assert.deepEqual(await getSupportedCurrencies(fetcher), [{ code: 'USD', name: 'US Dollar', symbol: '$' }]);
    assert.deepEqual(await getExchangeRate('USD', 'COP', fetcher, '2026-10-26'), {
        base: 'USD',
        quote: 'COP',
        rate: 3900.25,
        date: '2026-10-26'
    });
    assert.deepEqual(requestedUrls, [
        'https://api.frankfurter.dev/v2/currencies',
        'https://api.frankfurter.dev/v2/rate/USD/COP?date=2026-10-26'
    ]);
});

test('rechaza códigos y respuestas de tasa no válidos', async () => {
    let requested = false;
    await assert.rejects(() => getExchangeRate('US', 'COP', async () => {
        requested = true;
    }), /códigos de moneda no son válidos/);
    assert.equal(requested, false);

    await assert.rejects(() => getExchangeRate('USD', 'COP', async () => ({
        ok: true,
        json: async () => ({ date: '2026-10-26', base: 'EUR', quote: 'COP', rate: 3900 })
    })), /cotización no válida/);
    await assert.rejects(() => getExchangeRate('USD', 'COP', async () => ({}), '2026-02-31'), /fecha de cotización no es válida/);
    assert.equal(currentExchangeRateDate(new Date('2026-10-27T02:00:00.000Z')), '2026-10-26');
    assert.equal(isValidExchangeRateDate('2026-10-26'), true);
    assert.equal(isValidExchangeRateDate('2026-02-31'), false);
});
