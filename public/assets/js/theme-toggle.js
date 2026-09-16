/**
 * Theme Manager - Notaire
 * Maneja el cambio de tema entre "Tema Notaire" y "Tema Oscuro".
 * Persiste la preferencia en localStorage y actualiza dinámicamente la UI.
 */

(function() {
    // Función para obtener el tema actual
    function getCurrentTheme() {
        return localStorage.getItem('notaire_theme') || 'notaire';
    }

    // Aplicar el tema en el elemento html
    function applyTheme(theme) {
        document.documentElement.setAttribute('data-theme', theme);
        localStorage.setItem('notaire_theme', theme);
        updateToggleControls(theme);
    }

    // Actualizar botones o selects de cambio de tema en la interfaz
    function updateToggleControls(theme) {
        const themeBtn = document.getElementById('themeToggleBtn');
        const themeSelect = document.getElementById('themeSelect');

        if (themeBtn) {
            const icon = themeBtn.querySelector('i');
            const label = themeBtn.querySelector('span');
            if (theme === 'dark') {
                if (icon) icon.className = 'fas fa-palette';
                if (label) label.textContent = 'Tema Notaire';
                themeBtn.setAttribute('title', 'Cambiar a Tema Notaire');
            } else {
                if (icon) icon.className = 'fas fa-moon';
                if (label) label.textContent = 'Tema Oscuro';
                themeBtn.setAttribute('title', 'Cambiar a Tema Oscuro');
            }
        }

        if (themeSelect) {
            themeSelect.value = theme;
        }
    }

    // Cambiar entre temas de forma cíclica
    window.toggleTheme = function() {
        const current = getCurrentTheme();
        const nextTheme = current === 'notaire' ? 'dark' : 'notaire';
        applyTheme(nextTheme);
    };

    // Establecer un tema específico ('notaire' o 'dark')
    window.switchTheme = function(themeName) {
        if (themeName === 'notaire' || themeName === 'dark') {
            applyTheme(themeName);
        }
    };

    // Inicializar tema al cargar la página
    document.addEventListener('DOMContentLoaded', () => {
        applyTheme(getCurrentTheme());

        // Escuchar clics en el botón de tema si existe
        const themeBtn = document.getElementById('themeToggleBtn');
        if (themeBtn) {
            themeBtn.addEventListener('click', (e) => {
                e.preventDefault();
                window.toggleTheme();
            });
        }

        // Escuchar cambios en selector si existe
        const themeSelect = document.getElementById('themeSelect');
        if (themeSelect) {
            themeSelect.addEventListener('change', (e) => {
                window.switchTheme(e.target.value);
            });
        }
    });
})();
