/**
 * Auth Guard - Notaire
 * Este script maneja la verificación de sesión por rol en el frontend,
 * la aplicación del tema seleccionado y la función de logout.
 * Se incluye en el <head> de todas las páginas protegidas.
 */

(function() {
    // 1. Cargar y aplicar tema inmediatamente para evitar parpadeos
    const savedTheme = localStorage.getItem('notaire_theme') || 'notaire';
    document.documentElement.setAttribute('data-theme', savedTheme);

    // Helper para obtener cookies por su nombre
    function getCookie(name) {
        const value = `; ${document.cookie}`;
        const parts = value.split(`; ${name}=`);
        if (parts.length === 2) return parts.pop().split(';').shift();
        return null;
    }

    // Determinar la ruta adecuada para redirigir al login
    function getLoginRedirectPath() {
        const pathname = window.location.pathname;
        if (pathname.includes('/panel_control/')) {
            return '../../auth/login.html';
        }
        return '/auth/login.html';
    }

    // Limpiar sesión y redirigir
    function clearSessionAndRedirect() {
        document.cookie = "session_token=; Max-Age=0; path=/;";
        document.cookie = "user_role=; Max-Age=0; path=/;";
        localStorage.removeItem('user_role');
        localStorage.removeItem('user_email');
        
        const currentPath = window.location.pathname;
        if (!currentPath.includes('/auth/login.html') && !currentPath.endsWith('/login.html')) {
            console.warn('Acceso no autorizado o sesión inválida. Redirigiendo al login...');
            window.location.href = getLoginRedirectPath();
        }
    }

    // Verificar rol actual
    const userRole = getCookie('user_role') || localStorage.getItem('user_role');
    const currentPath = window.location.pathname;

    // Control de Acceso por Ruta (RBAC Frontend)
    if (!userRole) {
        clearSessionAndRedirect();
        return;
    }

    // Si intenta acceder al panel admin sin ser admin
    if (currentPath.includes('/panel_control/admin/') && userRole !== 'admin') {
        console.warn('Intento de acceso a Admin sin rol adecuado');
        clearSessionAndRedirect();
        return;
    }

    // Si intenta acceder al panel cliente sin ser cliente
    if (currentPath.includes('/panel_control/cliente/') && userRole !== 'cliente') {
        console.warn('Intento de acceso a Cliente sin rol adecuado');
        clearSessionAndRedirect();
        return;
    }

    // Validación opcional con backend cuando la API está disponible
    if (window.fetch && !currentPath.includes('/auth/login.html')) {
        fetch('/api/auth/verify')
            .then(res => res.json())
            .then(data => {
                if (data && data.authenticated === false) {
                    // El servidor indica que la sesión ya no es válida
                    clearSessionAndRedirect();
                }
            })
            .catch(() => {
                // Modo offline / servidor estático: continuar con la verificación local
            });
    }

    // Exportar función de logout globalmente
    window.logout = async function() {
        try {
            await fetch('/api/auth/logout', { method: 'POST' });
        } catch (error) {
            console.warn('Logout API no disponible:', error);
        }
        clearSessionAndRedirect();
    };
})();
