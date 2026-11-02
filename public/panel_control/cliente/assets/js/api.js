const API_BASE_URL = '/api';
const pendingApiGets = new Map();
const cachedApiGets = new Map();
const API_GET_CACHE_TTL_MS = 30_000;
let apiCacheVersion = 0;

function invalidateApiCache() {
    apiCacheVersion += 1;
    cachedApiGets.clear();
    pendingApiGets.clear();
    if (typeof invalidateDashboardMetricsCache === 'function') invalidateDashboardMetricsCache();
}

/**
 * Función genérica para realizar peticiones HTTP.
 */
async function apiFetch(endpoint, method = 'GET', body = null) {
    const methodUpper = method.toUpperCase();
    const token = localStorage.getItem('notaire_token');
    const headers = {
        'Content-Type': 'application/json',
        Accept: 'application/json'
    };

    if (token) {
        headers.Authorization = `Bearer ${token}`;
    }

    const config = { method: methodUpper, headers };

    if (body && ['POST', 'PUT', 'PATCH'].includes(methodUpper)) {
        config.body = JSON.stringify(body);
    }

    const cacheKey = methodUpper === 'GET' ? `${token || ''}:${endpoint}` : null;
    if (cacheKey) {
        const cached = cachedApiGets.get(cacheKey);
        if (cached && cached.expiresAt > Date.now()) return cached.value;
        if (cached) cachedApiGets.delete(cacheKey);

        if (pendingApiGets.has(cacheKey)) {
            return pendingApiGets.get(cacheKey);
        }
    }

    const requestCacheVersion = apiCacheVersion;
    const request = (async () => {
        try {
            const response = await fetch(`${API_BASE_URL}${endpoint}`, config);

            if (response.status === 401) {
                window.location.href = '/auth/login.html';
                return null;
            }

            if (!response.ok) {
                throw new Error(`HTTP Error: ${response.status}`);
            }

            const data = await response.json();
            if (cacheKey && requestCacheVersion === apiCacheVersion) {
                cachedApiGets.set(cacheKey, {
                    value: data,
                    expiresAt: Date.now() + API_GET_CACHE_TTL_MS
                });
            } else if (methodUpper !== 'GET') {
                invalidateApiCache();
            }
            return data;
        } catch (error) {
            console.error(`Error en API (${endpoint}):`, error);
            throw error;
        }
    })();

    if (cacheKey) pendingApiGets.set(cacheKey, request);
    try {
        return await request;
    } finally {
        if (cacheKey && pendingApiGets.get(cacheKey) === request) {
            pendingApiGets.delete(cacheKey);
        }
    }
}

async function fetchDashboardMetrics() {
    const token = localStorage.getItem('notaire_token');
    const response = await fetch('/api/v1/cliente/dashboard-summary' + (window.NotaireFinancialChart?.monthQuery() || ''), {
        headers: { Authorization: `Bearer ${token}` }
    });
    if (!response.ok) throw new Error(`HTTP Error: ${response.status}`);
    return response.json();
}

async function fetchTransacciones(mes = null) {
    const query = mes ? `?mes=${encodeURIComponent(mes)}` : '';
    return apiFetch(`/transacciones${query}`);
}

async function fetchMetas() {
    return apiFetch('/metas');
}

async function crearGasto(dataGasto) {
    return apiFetch('/transacciones', 'POST', { ...dataGasto, tipo: 'gasto' });
}
