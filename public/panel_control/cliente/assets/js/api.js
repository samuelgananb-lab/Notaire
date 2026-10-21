const API_BASE_URL = '/api';

/**
 * Función genérica para realizar peticiones HTTP.
 */
async function apiFetch(endpoint, method = 'GET', body = null) {
    const token = localStorage.getItem('notaire_token');
    const headers = {
        'Content-Type': 'application/json',
        Accept: 'application/json'
    };

    if (token) {
        headers.Authorization = `Bearer ${token}`;
    }

    const config = { method, headers };

    if (body && ['POST', 'PUT', 'PATCH'].includes(method)) {
        config.body = JSON.stringify(body);
    }

    try {
        const response = await fetch(`${API_BASE_URL}${endpoint}`, config);

        if (response.status === 401) {
            window.location.href = '/auth/login.html';
            return null;
        }

        if (!response.ok) {
            throw new Error(`HTTP Error: ${response.status}`);
        }

        return await response.json();
    } catch (error) {
        console.error(`Error en API (${endpoint}):`, error);
        throw error;
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

async function fetchTransacciones(periodo = 'este_mes') {
    return apiFetch(`/transacciones?periodo=${encodeURIComponent(periodo)}`);
}

async function fetchMetas() {
    return apiFetch('/metas');
}

async function crearGasto(dataGasto) {
    return apiFetch('/transacciones', 'POST', { ...dataGasto, tipo: 'gasto' });
}
