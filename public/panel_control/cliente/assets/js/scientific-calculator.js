(function () {
    const root = document.getElementById('scientificCalculator');
    if (!root) return;

    const expressionOutput = document.getElementById('calculatorExpression');
    const resultOutput = document.getElementById('calculatorResult');
    const keypad = document.getElementById('calculatorKeypad');
    const angleButton = document.getElementById('calculatorAngleMode');
    const historyList = document.getElementById('calculatorHistoryList');
    const clearHistoryButton = document.getElementById('calculatorClearHistory');
    const historyMoreButton = document.getElementById('calculatorHistoryMore');
    const historyMoreLabel = document.getElementById('calculatorHistoryMoreLabel');
    const historyMorePanel = document.getElementById('calculatorHistoryMorePanel');
    const historyMoreList = document.getElementById('calculatorHistoryMoreList');
    const historyCloseButton = document.getElementById('calculatorHistoryClose');
    const memoryIndicator = document.getElementById('calculatorMemoryIndicator');
    const maxHistoryItems = 10;
    const visibleHistoryItems = 3;
    let expression = '';
    let degrees = true;
    let justEvaluated = false;
    let secondFunctions = false;
    let memoryValue = 0;
    const historyStorageKey = `notaire_calculator_history:${getAccountKey()}`;
    let history = readHistory();

    function getAccountKey() {
        try {
            const user = JSON.parse(localStorage.getItem('notaire_user') || '{}');
            return String(user.id || user.auth_id || user.email || 'guest').toLowerCase();
        } catch (error) {
            console.error('No se pudo identificar la cuenta para el historial de cálculos:', error);
            return 'guest';
        }
    }

    function readHistory() {
        try {
            const records = JSON.parse(localStorage.getItem(historyStorageKey) || '[]');
            return Array.isArray(records) ? records.slice(0, maxHistoryItems) : [];
        } catch (error) {
            console.error('No se pudo cargar el historial de cálculos:', error);
            return [];
        }
    }

    function saveHistory() {
        history = history.slice(0, maxHistoryItems);
        try {
            localStorage.setItem(historyStorageKey, JSON.stringify(history));
        } catch (error) {
            console.error('No se pudo guardar el historial de cálculos:', error);
        }
        renderHistory();
    }

    function renderHistoryEntries(list, records, emptyMessage) {
        if (!list) return;
        list.replaceChildren();
        if (!records.length && emptyMessage) {
            const empty = document.createElement('div');
            empty.className = 'calculator-history-empty';
            const icon = document.createElement('i');
            icon.className = 'fas fa-clock-rotate-left';
            const text = document.createElement('span');
            text.textContent = emptyMessage;
            empty.append(icon, text);
            list.append(empty);
            return;
        }

        const dateFormatter = new Intl.DateTimeFormat(window.getCurrentLang?.() === 'en' ? 'en' : 'es-CO', {
            dateStyle: 'short',
            timeStyle: 'short'
        });
        records.forEach(record => {
            const item = document.createElement('button');
            item.type = 'button';
            item.className = 'calculator-history-entry';
            item.dataset.expression = record.expression;
            const expressionLabel = document.createElement('span');
            expressionLabel.className = 'calculator-history-expression';
            expressionLabel.textContent = `${displayExpression(record.expression)} =`;
            const resultLabel = document.createElement('span');
            resultLabel.className = 'calculator-history-result';
            resultLabel.textContent = record.result;
            const date = document.createElement('time');
            date.dateTime = record.createdAt;
            date.textContent = dateFormatter.format(new Date(record.createdAt));
            item.append(expressionLabel, resultLabel, date);
            list.append(item);
        });
    }

    function setHistoryMenuOpen(isOpen) {
        if (!historyMoreButton || !historyMorePanel) return;
        historyMorePanel.dataset.open = String(isOpen);
        historyMorePanel.setAttribute('aria-hidden', String(!isOpen));
        historyMoreButton.setAttribute('aria-expanded', String(isOpen));
        const icon = historyMoreButton.querySelector('i');
        if (icon) {
            icon.classList.toggle('fa-chevron-down', !isOpen);
            icon.classList.toggle('fa-chevron-up', isOpen);
        }
    }

    function renderHistory() {
        if (!historyList) return;
        const english = window.getCurrentLang?.() === 'en';
        renderHistoryEntries(historyList, history.slice(0, visibleHistoryItems), history.length
            ? ''
            : (english ? 'Your completed calculations will be saved here.' : 'Tus cálculos realizados aparecerán aquí.'));
        renderHistoryEntries(historyMoreList, history.slice(visibleHistoryItems, maxHistoryItems), english
            ? 'There are no older calculations yet.'
            : 'No hay operaciones anteriores todavía.');
        const additionalCount = Math.min(Math.max(history.length - visibleHistoryItems, 0), maxHistoryItems - visibleHistoryItems);
        if (historyMoreButton) {
            historyMoreButton.hidden = false;
            if (historyMoreLabel) {
                historyMoreLabel.textContent = additionalCount
                    ? (english ? `See ${additionalCount} more` : `Ver ${additionalCount} más`)
                    : (english ? 'View history' : 'Ver historial');
            }
            historyMoreButton.setAttribute('aria-label', english
                ? (additionalCount ? `Show ${additionalCount} older calculations` : 'Open calculation history')
                : (additionalCount ? `Mostrar ${additionalCount} operaciones anteriores` : 'Abrir historial de operaciones'));
        }
        if (additionalCount === 0) setHistoryMenuOpen(false);
    }

    function getFrankfurterPath(path) {
        const requestUrl = new URL(path, 'https://notaire.invalid');
        const apiPath = requestUrl.pathname.replace(/^\/api\/exchange-rates/, '');
        if (apiPath === '/currencies') return apiPath;
        if (apiPath === '/rate') {
            const base = requestUrl.searchParams.get('base')?.toUpperCase() || '';
            const quote = requestUrl.searchParams.get('quote')?.toUpperCase() || '';
            const date = requestUrl.searchParams.get('date') || '';
            if (!/^[A-Z]{3}$/.test(base) || !/^[A-Z]{3}$/.test(quote)) {
                throw new Error('Los códigos de moneda no son válidos.');
            }
            if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error('La fecha de cotización no es válida.');
            return `/rate/${encodeURIComponent(base)}/${encodeURIComponent(quote)}?${new URLSearchParams({ date })}`;
        }
        throw new Error('La ruta de conversión no es válida.');
    }

    function initCurrencyConverter() {
        const fromSelect = document.getElementById('currencyFrom');
        const toSelect = document.getElementById('currencyTo');
        const fromAmount = document.getElementById('currencyAmountFrom');
        const toAmount = document.getElementById('currencyAmountTo');
        const fromPrefix = document.getElementById('currencyFromPrefix');
        const toPrefix = document.getElementById('currencyToPrefix');
        const rateOutput = document.getElementById('currencyRateValue');
        const updatedOutput = document.getElementById('currencyRateUpdated');
        const swapButton = document.getElementById('currencySwap');
        const refreshButton = document.getElementById('currencyRateRefresh');
        const titleElement = document.getElementById('currencyConverterTitle');
        const eyebrowElement = document.getElementById('currencyConverterEyebrow');
        if (!fromSelect || !toSelect || !fromAmount || !toAmount || !rateOutput || !updatedOutput) return;

        const fallbackCurrencies = [
            { code: 'USD', name: 'Dólar estadounidense', symbol: '$' },
            { code: 'COP', name: 'Peso colombiano', symbol: '$' },
            { code: 'EUR', name: 'Euro', symbol: '€' },
            { code: 'GBP', name: 'Libra esterlina', symbol: '£' },
            { code: 'JPY', name: 'Yen japonés', symbol: '¥' }
        ];
        let currencies = fallbackCurrencies;
        let exchangeRate = null;
        let exchangeRateDate = '';
        let requestId = 0;
        let editedSide = 'from';
        let currencyCatalogLoaded = false;
        let currencyCatalogPromise = null;

        const locale = () => window.getCurrentLang?.() === 'en' ? 'en-US' : 'es-CO';
        const currencyName = currency => {
            try {
                return new Intl.DisplayNames([locale()], { type: 'currency' }).of(currency.code) || currency.name;
            } catch {
                return currency.name;
            }
        };
        const currencySymbol = code => {
            try {
                return new Intl.NumberFormat(locale(), { style: 'currency', currency: code, currencyDisplay: 'narrowSymbol' })
                    .formatToParts(0).find(part => part.type === 'currency')?.value || code;
            } catch {
                return code;
            }
        };
        const parseAmount = value => {
            const parts = new Intl.NumberFormat(locale()).formatToParts(1234.5);
            const groupSeparator = parts.find(part => part.type === 'group')?.value || ',';
            const decimalSeparator = parts.find(part => part.type === 'decimal')?.value || '.';
            const normalized = String(value).trim()
                .split(groupSeparator).join('')
                .replace(/\s/g, '')
                .replace(decimalSeparator, '.')
                .replace(/[^\d.+-]/g, '');
            return Number(normalized);
        };
        const formatAmount = value => new Intl.NumberFormat(locale(), {
            maximumFractionDigits: 4,
            minimumFractionDigits: 0
        }).format(value);
        const localRateDate = () => {
            const parts = new Intl.DateTimeFormat('en-CA', {
                timeZone: 'America/Bogota',
                year: 'numeric',
                month: '2-digit',
                day: '2-digit'
            }).formatToParts(new Date());
            const year = parts.find(part => part.type === 'year')?.value;
            const month = parts.find(part => part.type === 'month')?.value;
            const day = parts.find(part => part.type === 'day')?.value;
            return `${year}-${month}-${day}`;
        };
        const requestHeaders = () => ({
            Authorization: `Bearer ${localStorage.getItem('notaire_token') || ''}`
        });
        const fetchCurrencyData = async path => {
            let internalError;
            try {
                const response = await fetch(path, { headers: requestHeaders() });
                if (!response.ok) throw new Error(`API de Notaire respondió HTTP ${response.status}`);
                return await response.json();
            } catch (error) {
                internalError = error;
            }

            try {
                const externalPath = getFrankfurterPath(path);
                const response = await fetch(`https://api.frankfurter.dev/v2${externalPath}`, {
                    headers: { Accept: 'application/json' }
                });
                if (!response.ok) throw new Error(`Frankfurter respondió HTTP ${response.status}`);
                const data = await response.json();
                if (externalPath === '/currencies' && Array.isArray(data)) {
                    const preferredCodes = ['COP', 'USD', 'EUR', 'GBP', 'JPY', 'CNY', 'CHF', 'CAD', 'AUD', 'NZD', 'MXN', 'BRL', 'INR', 'KRW', 'SGD', 'HKD', 'SEK', 'NOK', 'DKK', 'PLN', 'AED', 'SAR', 'ZAR'];
                    const priority = new Map(preferredCodes.map((code, index) => [code, index]));
                    const latestCurrencyDate = new Date();
                    latestCurrencyDate.setUTCDate(latestCurrencyDate.getUTCDate() - 7);
                    const activeSince = latestCurrencyDate.toISOString().slice(0, 10);
                    const currencies = data
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
                        }));
                    currencies.sort((left, right) =>
                        (priority.get(left.code) ?? Number.MAX_SAFE_INTEGER) -
                        (priority.get(right.code) ?? Number.MAX_SAFE_INTEGER) ||
                        left.name.localeCompare(right.name)
                    );
                    return { currencies };
                }
                return data;
            } catch (error) {
                throw new Error(`No se pudo consultar la API de Notaire ni Frankfurter: ${internalError.message}; ${error.message}`);
            }
        };
        const mergeFallbackCurrencies = catalog => {
            const available = new Map(catalog.map(currency => [currency.code, currency]));
            fallbackCurrencies.forEach(currency => {
                if (!available.has(currency.code)) available.set(currency.code, currency);
            });
            return [...available.values()];
        };
        const setStatus = (message, isError = false) => {
            rateOutput.textContent = message;
            rateOutput.classList.toggle('is-error', isError);
        };
        const refreshPrefixes = () => {
            fromPrefix.textContent = currencySymbol(fromSelect.value);
            toPrefix.textContent = currencySymbol(toSelect.value);
        };
        const updateConvertedAmount = side => {
            if (!exchangeRate) return;
            const input = side === 'from' ? fromAmount : toAmount;
            const output = side === 'from' ? toAmount : fromAmount;
            const amount = parseAmount(input.value || '0');
            if (!Number.isFinite(amount) || amount < 0) return;
            const converted = side === 'from' ? amount * exchangeRate : amount / exchangeRate;
            output.value = formatAmount(converted);
        };
        const renderRateDate = date => {
            if (!date) {
                exchangeRateDate = '';
                updatedOutput.textContent = '';
                return;
            }
            const parsedDate = new Date(`${date}T12:00:00Z`);
            exchangeRateDate = date;
            const formattedDate = Number.isNaN(parsedDate.getTime())
                ? date
                : new Intl.DateTimeFormat(locale(), { dateStyle: 'medium' }).format(parsedDate);
            const prefix = window.getCurrentLang?.() === 'en' ? 'Daily reference · Frankfurter · ' : 'Referencia diaria · Frankfurter · ';
            updatedOutput.textContent = `${prefix}${formattedDate}`;
        };
        const loadRate = async (forceRefresh = false) => {
            const currentRequestId = ++requestId;
            const base = fromSelect.value;
            const quote = toSelect.value;
            exchangeRate = null;
            refreshPrefixes();
            if (!base || !quote) {
                const english = window.getCurrentLang?.() === 'en';
                setStatus(english ? 'Select two currencies to see the exchange rate.' : 'Selecciona dos monedas para consultar la tasa.', true);
                toAmount.value = '';
                updatedOutput.textContent = '';
                return;
            }
            setStatus(window.getCurrentLang?.() === 'en' ? 'Loading exchange rate...' : 'Cargando tasa de cambio...');
            updatedOutput.textContent = '';
            try {
                if (base === quote) {
                    exchangeRate = 1;
                    renderRateDate(localRateDate());
                } else {
                    const params = new URLSearchParams({ base, quote, date: localRateDate() });
                    if (forceRefresh) params.set('refresh', '1');
                    const result = await fetchCurrencyData(`/api/exchange-rates/rate?${params}`);
                    if (currentRequestId !== requestId) return;
                    if (result.base !== base || result.quote !== quote || !Number.isFinite(result.rate) || result.rate <= 0) {
                        throw new Error('La tasa recibida no es válida.');
                    }
                    exchangeRate = result.rate;
                    renderRateDate(result.date);
                }
                if (currentRequestId !== requestId) return;
                setStatus(`1 ${base} = ${formatAmount(exchangeRate)} ${quote}`);
                updateConvertedAmount(editedSide);
            } catch (error) {
                if (currentRequestId !== requestId) return;
                console.error(`No se pudo cargar la tasa ${base}/${quote}:`, error);
                const english = window.getCurrentLang?.() === 'en';
                setStatus(english ? 'Rate unavailable. Try again.' : 'Tasa no disponible. Intenta actualizar.', true);
                toAmount.value = '';
                exchangeRateDate = '';
                updatedOutput.textContent = '';
            }
        };
        const populateSelect = select => {
            const selectedValue = select.value;
            select.replaceChildren();
            currencies.forEach(currency => {
                const option = document.createElement('option');
                option.value = currency.code;
                option.textContent = `${currency.code} — ${currencyName(currency)}`;
                select.append(option);
            });
            const otherSelect = select === fromSelect ? toSelect : fromSelect;
            const preferredCode = select === fromSelect ? 'USD' : 'COP';
            const options = Array.from(select.options, option => option.value);
            const distinctOptions = options.filter(code => code !== otherSelect.value);
            const candidates = [selectedValue, preferredCode, ...options];
            select.value = candidates.find(code => options.includes(code) && (code !== otherSelect.value || distinctOptions.length === 0)) || options[0] || '';
        };
        const updateLanguage = () => {
            const english = window.getCurrentLang?.() === 'en';
            if (titleElement) titleElement.textContent = english ? 'Exchange rate' : 'Tasa de cambio';
            if (eyebrowElement) eyebrowElement.textContent = english ? 'CURRENCIES' : 'MONEDAS';
            fromSelect.setAttribute('aria-label', english ? 'Source currency' : 'Moneda de origen');
            toSelect.setAttribute('aria-label', english ? 'Target currency' : 'Moneda de destino');
            fromAmount.setAttribute('aria-label', english ? 'Source amount' : 'Cantidad de moneda de origen');
            toAmount.setAttribute('aria-label', english ? 'Target amount' : 'Cantidad de moneda de destino');
            refreshButton?.setAttribute('aria-label', english ? 'Refresh exchange rate' : 'Actualizar tasa');
            refreshButton?.setAttribute('title', english ? 'Refresh exchange rate' : 'Actualizar tasa');
            swapButton?.setAttribute('aria-label', english ? 'Swap currencies' : 'Intercambiar monedas');
            swapButton?.setAttribute('title', english ? 'Swap currencies' : 'Intercambiar monedas');
            populateSelect(fromSelect);
            populateSelect(toSelect);
            refreshPrefixes();
            if (exchangeRate) setStatus(`1 ${fromSelect.value} = ${formatAmount(exchangeRate)} ${toSelect.value}`);
            renderRateDate(exchangeRateDate);
        };

        fromSelect.addEventListener('change', () => {
            editedSide = 'from';
            void loadRate();
        });
        toSelect.addEventListener('change', () => {
            editedSide = 'from';
            void loadRate();
        });
        fromAmount.addEventListener('input', () => {
            editedSide = 'from';
            updateConvertedAmount('from');
        });
        toAmount.addEventListener('input', () => {
            editedSide = 'to';
            updateConvertedAmount('to');
        });
        [fromAmount, toAmount].forEach((input, index) => {
            input.addEventListener('blur', () => {
                const amount = parseAmount(input.value);
                if (Number.isFinite(amount) && amount >= 0) input.value = formatAmount(amount);
                updateConvertedAmount(index === 0 ? 'from' : 'to');
            });
        });
        swapButton?.addEventListener('click', () => {
            const previousFrom = fromSelect.value;
            fromSelect.value = toSelect.value;
            toSelect.value = previousFrom;
            [fromAmount.value, toAmount.value] = [toAmount.value, fromAmount.value];
            editedSide = 'from';
            void loadRate();
        });
        refreshButton?.addEventListener('click', () => void loadRate(true));
        document.addEventListener('notaire:languagechange', updateLanguage);
        updateLanguage();

        const loadCurrencyCatalog = () => {
            if (currencyCatalogLoaded) return Promise.resolve();
            if (currencyCatalogPromise) return currencyCatalogPromise;
            currencyCatalogPromise = fetchCurrencyData('/api/exchange-rates/currencies')
            .then(result => {
                if (!Array.isArray(result.currencies) || !result.currencies.length) throw new Error('El catálogo de monedas está vacío.');
                currencies = mergeFallbackCurrencies(result.currencies);
                populateSelect(fromSelect);
                populateSelect(toSelect);
                refreshPrefixes();
                currencyCatalogLoaded = true;
                return loadRate();
            })
            .catch(error => {
                console.error('No se pudo cargar el catálogo de monedas:', error);
                const english = window.getCurrentLang?.() === 'en';
                setStatus(english ? 'Currency list unavailable. Using main currencies.' : 'Lista no disponible. Se usan las monedas principales.', true);
                void loadRate();
            })
            .finally(() => {
                currencyCatalogPromise = null;
            });
            return currencyCatalogPromise;
        };
        document.addEventListener('click', event => {
            if (event.target instanceof Element && event.target.closest('#sidebarMenu a[data-target="view-calculadora"]')) {
                void loadCurrencyCatalog();
            }
        });
        const calculatorView = document.getElementById('view-calculadora');
        const loadCatalogIfCalculatorIsActive = () => {
            if (!calculatorView?.classList.contains('active')) return false;
            void loadCurrencyCatalog();
            return true;
        };
        if (!loadCatalogIfCalculatorIsActive() && calculatorView) {
            const viewObserver = new MutationObserver(() => {
                if (!loadCatalogIfCalculatorIsActive()) return;
                viewObserver.disconnect();
            });
            viewObserver.observe(calculatorView, { attributes: true, attributeFilter: ['class'] });
        }
    }

    function displayExpression(value) {
        return value.replace(/\bpowten\(/g, '10^(').replace(/\bpi\b/g, 'π').replace(/\*/g, '×').replace(/\//g, '÷');
    }

    function evaluate(source) {
        const compactSource = source.replace(/\s/g, '');
        const tokens = compactSource.match(/(?:\d*\.?\d+(?:e[+-]?\d+)?|[a-z]+|[()+\-*/^%!])/gi);
        if (!tokens || tokens.join('') !== compactSource) {
            throw new Error('Expresión no válida');
        }
        const normalizedTokens = [];
        const isNumber = token => /^\d/i.test(token) || /^\.\d/.test(token);
        const endsValue = token => isNumber(token) || /^(?:pi|e|[)!%])$/i.test(token);
        const startsValue = token => isNumber(token) ||
            /^(?:pi|e|\(|sin|cos|tan|asin|acos|atan|sqrt|ln|log|abs|sinh|cosh|tanh|asinh|acosh|atanh|exp|powten)$/i.test(token);
        tokens.forEach((token, tokenIndex) => {
            const previous = tokens[tokenIndex - 1];
            if (previous && endsValue(previous) && startsValue(token)) {
                normalizedTokens.push('*');
            }
            normalizedTokens.push(token);
        });
        let index = 0;
        const peek = () => normalizedTokens[index];
        const take = () => normalizedTokens[index++];
        const expect = token => {
            if (take() !== token) throw new Error('Expresión no válida');
        };
        const factorial = value => {
            if (!Number.isInteger(value) || value < 0 || value > 170) throw new Error('Factorial no definido');
            let result = 1;
            for (let n = 2; n <= value; n += 1) result *= n;
            return result;
        };
        const functions = {
            sin: value => cleanTrig(Math.sin(degrees ? value * Math.PI / 180 : value)),
            cos: value => cleanTrig(Math.cos(degrees ? value * Math.PI / 180 : value)),
            tan: value => {
                const radians = degrees ? value * Math.PI / 180 : value;
                if (Math.abs(Math.cos(radians)) < 1e-12) throw new Error('Resultado no definido');
                return cleanTrig(Math.tan(radians));
            },
            asin: value => degrees ? Math.asin(value) * 180 / Math.PI : Math.asin(value),
            acos: value => degrees ? Math.acos(value) * 180 / Math.PI : Math.acos(value),
            atan: value => degrees ? Math.atan(value) * 180 / Math.PI : Math.atan(value),
            sqrt: value => Math.sqrt(value),
            ln: value => Math.log(value),
            log: value => Math.log10(value),
            abs: value => Math.abs(value),
            sinh: value => Math.sinh(value),
            cosh: value => Math.cosh(value),
            tanh: value => Math.tanh(value),
            asinh: value => Math.asinh(value),
            acosh: value => Math.acosh(value),
            atanh: value => Math.atanh(value),
            exp: value => Math.exp(value),
            powten: value => 10 ** value
        };

        function cleanTrig(value) {
            if (Math.abs(value) < 1e-14) return 0;
            if (Math.abs(value - 1) < 1e-14) return 1;
            if (Math.abs(value + 1) < 1e-14) return -1;
            return value;
        }

        function parsePrimary() {
            const token = take();
            if (token === '(') {
                const value = parseExpression();
                expect(')');
                return value;
            }
            if (/^\d/i.test(token || '.') || /^\.\d/.test(token || '')) return Number(token);
            if (token === 'pi') return Math.PI;
            if (token === 'e') return Math.E;
            if (Object.hasOwn(functions, token)) {
                expect('(');
                const argument = parseExpression();
                expect(')');
                return functions[token](argument);
            }
            throw new Error('Expresión no válida');
        }

        function parsePostfix() {
            let value = parsePrimary();
            while (peek() === '%' || peek() === '!') {
                value = take() === '%' ? value / 100 : factorial(value);
            }
            return value;
        }

        function parsePower() {
            const base = parsePostfix();
            return peek() === '^' ? (take(), base ** parseUnary()) : base;
        }

        function parseUnary() {
            if (peek() === '+') return (take(), parseUnary());
            if (peek() === '-') return (take(), -parseUnary());
            return parsePower();
        }

        function parseProduct() {
            let value = parseUnary();
            while (peek() === '*' || peek() === '/') {
                const operator = take();
                const right = parseUnary();
                value = operator === '*' ? value * right : value / right;
            }
            return value;
        }

        function parseExpression() {
            let value = parseProduct();
            while (peek() === '+' || peek() === '-') {
                const operator = take();
                const right = parseProduct();
                value = operator === '+' ? value + right : value - right;
            }
            return value;
        }

        const result = parseExpression();
        if (index !== normalizedTokens.length || !Number.isFinite(result)) throw new Error('Resultado no definido');
        return result;
    }

    function completeParentheses(source) {
        let open = 0;
        for (const character of source) {
            if (character === '(') open += 1;
            if (character === ')') open -= 1;
            if (open < 0) throw new Error('Expresión no válida');
        }
        return source + ')'.repeat(open);
    }

    function evaluateComplete(source) {
        return evaluate(completeParentheses(source));
    }

    function formatResult(value) {
        if (Object.is(value, -0)) return '0';
        return Number(value.toPrecision(12)).toString();
    }

    function render() {
        expressionOutput.textContent = displayExpression(expression);
        if (!expression) {
            resultOutput.textContent = '0';
            resultOutput.classList.remove('calculator-error');
            return;
        }
        try {
            resultOutput.textContent = formatResult(evaluateComplete(expression));
            resultOutput.classList.remove('calculator-error');
        } catch {
            resultOutput.textContent = '';
            resultOutput.classList.remove('calculator-error');
        }
    }

    function append(value) {
        if (justEvaluated && (/^[0-9.]$/.test(value) || /^[a-z]+\($/.test(value) || value === 'pi' || value === 'e')) expression = '';
        justEvaluated = false;
        expression += value;
        render();
    }

    function getTrailingOperandRange() {
        const end = expression.length;
        if (!end) return null;
        let start = end;
        if (expression[end - 1] === ')') {
            let depth = 0;
            let openIndex = -1;
            for (let index = end - 1; index >= 0; index -= 1) {
                if (expression[index] === ')') depth += 1;
                if (expression[index] === '(' && --depth === 0) {
                    openIndex = index;
                    break;
                }
            }
            if (openIndex < 0) return null;
            start = openIndex;
            while (start > 0 && /[a-z]/i.test(expression[start - 1])) start -= 1;
        } else {
            const operand = expression.match(/(?:\d*\.?\d+(?:e[+-]?\d+)?|pi|e)$/i);
            if (!operand) return null;
            start = end - operand[0].length;
        }

        const previous = expression[start - 1];
        if (previous === '-' && (start === 1 || /[+\-*/^(]/.test(expression[start - 2]))) start -= 1;
        return { start, end };
    }

    function transformTrailingOperand(transform) {
        const range = getTrailingOperandRange();
        if (!range) return false;
        const operand = expression.slice(range.start, range.end);
        expression = `${expression.slice(0, range.start)}${transform(operand)}`;
        justEvaluated = false;
        render();
        return true;
    }

    function insertFunction(name) {
        if (!transformTrailingOperand(value => `${name}(${value})`)) append(`${name}(`);
    }

    function toggleSign() {
        transformTrailingOperand(value => {
            if (value.startsWith('-(') && value.endsWith(')')) return value.slice(2, -1);
            if (value.startsWith('-')) return value.slice(1);
            return `-(${value})`;
        });
    }

    function applyTransform(transform) {
        const operations = {
            reciprocal: value => `1/(${value})`,
            square: value => `(${value})^2`,
            cube: value => `(${value})^3`,
            sqrt: value => `sqrt(${value})`,
            'nth-root': value => `(${value})^(1/`
        };
        const operation = operations[transform];
        if (operation) transformTrailingOperand(operation);
    }

    function getCurrentValue() {
        if (!expression) return 0;
        return evaluateComplete(expression);
    }

    function updateMemoryIndicator() {
        if (memoryIndicator) memoryIndicator.textContent = memoryValue === 0 ? '' : 'M';
    }

    function updateAngleButton() {
        if (!angleButton) return;
        const english = window.getCurrentLang?.() === 'en';
        angleButton.textContent = degrees ? 'Rad' : 'Deg';
        angleButton.title = degrees
            ? (english ? 'Switch to radians' : 'Cambiar a radianes')
            : (english ? 'Switch to degrees' : 'Cambiar a grados');
        angleButton.setAttribute('aria-pressed', String(!degrees));
    }

    function handleMemoryAction(action) {
        if (action === 'memory-clear') {
            memoryValue = 0;
            updateMemoryIndicator();
            return;
        }
        if (action === 'memory-recall') {
            const value = formatResult(memoryValue);
            if (justEvaluated) expression = '';
            else if (getTrailingOperandRange()) expression += '*';
            expression += value;
            justEvaluated = false;
            render();
            return;
        }
        try {
            const currentValue = getCurrentValue();
            memoryValue += action === 'memory-add' ? currentValue : -currentValue;
            updateMemoryIndicator();
        } catch (error) {
            resultOutput.textContent = error.message;
            resultOutput.classList.add('calculator-error');
        }
    }

    function appendScientificExponent() {
        if (!/\d$/.test(expression) || /e[+-]?\d*$/i.test(expression)) return;
        expression += 'e';
        justEvaluated = false;
        render();
    }

    function appendRandomValue() {
        if (justEvaluated) expression = '';
        else if (getTrailingOperandRange()) expression += '*';
        expression += String(Math.random());
        justEvaluated = false;
        render();
    }

    function calculate() {
        if (!expression) return;
        try {
            const completedExpression = completeParentheses(expression);
            const result = formatResult(evaluate(completedExpression));
            expressionOutput.textContent = displayExpression(completedExpression) + ' =';
            expression = result;
            resultOutput.textContent = result;
            resultOutput.classList.remove('calculator-error');
            justEvaluated = true;
            history.unshift({ expression: completedExpression, result, createdAt: new Date().toISOString() });
            history = history.slice(0, maxHistoryItems);
            saveHistory();
        } catch (error) {
            resultOutput.textContent = error.message;
            resultOutput.classList.add('calculator-error');
            justEvaluated = false;
        }
    }

    keypad.addEventListener('click', event => {
        const button = event.target.closest('button');
        if (!button) return;
        if (button.dataset.action === 'clear') {
            expression = '';
            justEvaluated = false;
            render();
        } else if (button.dataset.action === 'delete') {
            expression = expression.slice(0, -1);
            justEvaluated = false;
            render();
        } else if (button.dataset.action === 'equals') {
            calculate();
        } else if (button.dataset.action === 'second') {
            secondFunctions = !secondFunctions;
            button.setAttribute('aria-pressed', String(secondFunctions));
            keypad.querySelectorAll('[data-alt-value]').forEach(key => {
                key.textContent = secondFunctions ? key.dataset.altLabel : key.dataset.label;
                key.setAttribute('aria-label', secondFunctions ? key.dataset.altLabel : key.dataset.label);
            });
        } else if (button.dataset.action?.startsWith('memory-')) {
            handleMemoryAction(button.dataset.action);
        } else if (button.dataset.action === 'sign') {
            toggleSign();
        } else if (button.dataset.action === 'ee') {
            appendScientificExponent();
        } else if (button.dataset.action === 'random') {
            appendRandomValue();
        } else if (button.dataset.transform) {
            applyTransform(button.dataset.transform);
        } else if (button.dataset.value) {
            const value = secondFunctions && button.dataset.altValue ? button.dataset.altValue : button.dataset.value;
            if (/^[a-z]+\($/.test(value)) insertFunction(value.slice(0, -1));
            else append(value);
        }
    });

    historyList?.addEventListener('click', event => {
        const entry = event.target.closest('.calculator-history-entry');
        if (!entry) return;
        expression = entry.dataset.expression || '';
        justEvaluated = false;
        render();
    });

    historyMoreList?.addEventListener('click', event => {
        const entry = event.target.closest('.calculator-history-entry');
        if (!entry) return;
        expression = entry.dataset.expression || '';
        justEvaluated = false;
        setHistoryMenuOpen(false);
        render();
    });

    historyMoreButton?.addEventListener('click', () => {
        setHistoryMenuOpen(historyMorePanel.dataset.open !== 'true');
    });

    historyCloseButton?.addEventListener('click', () => {
        setHistoryMenuOpen(false);
        historyMoreButton?.focus();
    });

    document.addEventListener('click', event => {
        if (historyMorePanel?.dataset.open !== 'true' || historyMoreButton?.contains(event.target) || historyMorePanel?.contains(event.target)) return;
        setHistoryMenuOpen(false);
    });

    clearHistoryButton?.addEventListener('click', () => {
        history = [];
        saveHistory();
    });

    angleButton.addEventListener('click', () => {
        degrees = !degrees;
        updateAngleButton();
        render();
    });

    document.addEventListener('keydown', event => {
        if (!document.getElementById('view-calculadora')?.classList.contains('active')) return;
        if (event.key === 'Escape' && historyMorePanel?.dataset.open === 'true') {
            setHistoryMenuOpen(false);
            historyMoreButton?.focus();
            return;
        }
        if (event.target instanceof HTMLElement && /^(INPUT|TEXTAREA|SELECT)$/.test(event.target.tagName)) return;
        if (/^[0-9.+\-*/^()%!]$/.test(event.key)) append(event.key);
        else if (event.key === 'Enter' || event.key === '=') calculate();
        else if (event.key === 'Backspace') {
            expression = expression.slice(0, -1);
            render();
        } else if (event.key === 'Escape') {
            expression = '';
            render();
        }
    });

    document.addEventListener('notaire:languagechange', renderHistory);
    updateAngleButton();
    renderHistory();
    render();
    initCurrencyConverter();
})();
