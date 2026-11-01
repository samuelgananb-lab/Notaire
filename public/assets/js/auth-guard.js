/**
 * Auth Guard - Notaire
 * Este script maneja la verificación de sesión por rol en el frontend,
 * la aplicación del tema seleccionado y la función de logout.
 * Se incluye en el <head> de todas las páginas protegidas.
 */

(function() {
    // 1. Cargar y aplicar tema inmediatamente para evitar parpadeos
    const storedTheme = localStorage.getItem('notaire_theme') || 'notaire';
    const savedTheme = storedTheme === 'auto'
        ? (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
        : (['dark', 'light', 'notaire'].includes(storedTheme) ? storedTheme : 'notaire');
    document.documentElement.setAttribute('data-theme', savedTheme);
    const savedPalette = localStorage.getItem('notaire_color_palette');
    if (['purple', 'blue', 'emerald', 'gold', 'rose', 'gray', 'black'].includes(savedPalette)) {
        document.documentElement.setAttribute('data-color-palette', savedPalette);
    }

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
        localStorage.removeItem('notaire_token');
        localStorage.removeItem('notaire_refresh_token');
        localStorage.removeItem('notaire_expires_at');
        localStorage.removeItem('notaire_user');
        
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

    // El empleado tiene su propio panel operativo
    if (currentPath.includes('/panel_control/admin/') && userRole === 'empleado') {
        window.location.replace('../empleado/dashboard.html');
        return;
    }

    if (currentPath.includes('/panel_control/empleado/') && userRole !== 'empleado') {
        console.warn('Intento de acceso al panel de empleado sin rol adecuado');
        window.location.replace(userRole === 'admin' ? '../admin/dashboard.html' : '../cliente/dashboard.html');
        return;
    }

    // Si intenta acceder al panel admin sin ser admin
    if (currentPath.includes('/panel_control/admin/') && !['admin', 'empleado'].includes(userRole)) {
        console.warn('Intento de acceso al panel operativo sin rol adecuado');
        clearSessionAndRedirect();
        return;
    }

    // Si intenta acceder al panel cliente sin ser cliente
    if (currentPath.includes('/panel_control/cliente/') && userRole !== 'cliente') {
        console.warn('Intento de acceso a Cliente sin rol adecuado');
        clearSessionAndRedirect();
        return;
    }

    async function refreshSession() {
        const refreshToken = localStorage.getItem('notaire_refresh_token');
        if (!refreshToken) return;
        const response = await fetch('/api/auth/refresh', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ refresh_token: refreshToken })
        });
        if (!response.ok) throw new Error('Sesión expirada');
        const data = await response.json();
        localStorage.setItem('notaire_token', data.token);
        if (data.refresh_token) localStorage.setItem('notaire_refresh_token', data.refresh_token);
        if (data.expires_at) localStorage.setItem('notaire_expires_at', String(data.expires_at));
    }

    refreshSession().catch(clearSessionAndRedirect);
    window.setInterval(() => refreshSession().catch(clearSessionAndRedirect), 10 * 60 * 1000);

    // Validación con backend cuando la API está disponible
    if (window.fetch && !currentPath.includes('/auth/login.html')) {
        fetch('/api/auth/verify', {
            headers: { Authorization: `Bearer ${localStorage.getItem('notaire_token') || ''}` }
        })
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

    function showNotaireDialog({ title, message, confirmText = 'Aceptar', cancelText = '', icon = 'fa-circle-info' }) {
        let dialog = document.getElementById('notaireAppDialog');
        if (!dialog) {
            const styles = document.createElement('style');
            styles.textContent = `
                .notaire-app-dialog {
                    position: fixed;
                    inset: 0;
                    margin: auto;
                    width: min(440px, calc(100vw - 32px));
                    max-height: min(90vh, 620px);
                    padding: 0;
                    overflow: auto;
                    color: var(--color-text-main, var(--text, #f4f1fa));
                    background: var(--color-card-bg, var(--card, #171321));
                    border: 1px solid var(--color-card-border, var(--border, rgba(255, 255, 255, .14)));
                    border-radius: 20px;
                    box-shadow: 0 24px 70px rgba(0, 0, 0, .55);
                    font: 400 14px/1.5 Outfit, sans-serif;
                }
                .notaire-app-dialog::backdrop {
                    background: rgba(8, 6, 14, .68);
                    backdrop-filter: blur(5px);
                }
                .notaire-app-content { padding: clamp(20px, 5vw, 28px); }
                .notaire-app-heading { display: flex; align-items: center; gap: 13px; margin-bottom: 10px; }
                .notaire-app-icon {
                    display: grid;
                    width: 44px;
                    height: 44px;
                    flex: 0 0 44px;
                    place-items: center;
                    border-radius: 14px;
                    background: rgba(var(--color-primary-rgb, 140, 0, 255), .16);
                    color: var(--color-primary, var(--primary, #a855f7));
                    font-size: 19px;
                }
                .notaire-app-title { margin: 0; color: inherit; font-size: 18px; font-weight: 650; }
                .notaire-app-message { margin: 0 0 22px 57px; color: var(--color-text-muted, var(--muted, #b8b2c4)); }
                .notaire-app-actions { display: flex; justify-content: flex-end; gap: 10px; }
                .notaire-app-actions button {
                    min-height: 42px;
                    padding: 0 17px;
                    border: 1px solid var(--color-card-border, var(--border, rgba(255, 255, 255, .14)));
                    border-radius: 11px;
                    color: inherit;
                    background: transparent;
                    font: inherit;
                    font-weight: 500;
                    cursor: pointer;
                    transition: background .2s ease, border-color .2s ease, transform .2s ease;
                }
                .notaire-app-actions button:hover { border-color: var(--color-primary, var(--primary, #a855f7)); transform: translateY(-1px); }
                .notaire-app-actions .notaire-app-confirm {
                    border-color: transparent;
                    background: linear-gradient(135deg, var(--color-primary, var(--primary, #8c00ff)), var(--color-secondary, #8b008b));
                    color: #fff;
                }
                .notaire-app-actions .notaire-app-confirm:hover { filter: brightness(1.08); }
                .notaire-app-actions button:focus-visible { outline: 2px solid var(--color-primary, var(--primary, #a855f7)); outline-offset: 3px; }
                @media (max-width: 480px) {
                    .notaire-app-message { margin-left: 0; }
                    .notaire-app-actions button { flex: 1; }
                }
                @media (prefers-reduced-motion: reduce) {
                    .notaire-app-actions button { transition: none; }
                }
            `;
            document.head.appendChild(styles);
            dialog = document.createElement('dialog');
            dialog.id = 'notaireAppDialog';
            dialog.className = 'notaire-app-dialog';
            dialog.setAttribute('aria-labelledby', 'notaireAppDialogTitle');
            dialog.innerHTML = `
                <div class="notaire-app-content">
                    <div class="notaire-app-heading">
                        <span class="notaire-app-icon" aria-hidden="true"><i></i></span>
                        <h2 class="notaire-app-title" id="notaireAppDialogTitle"></h2>
                    </div>
                    <p class="notaire-app-message"></p>
                    <div class="notaire-app-actions">
                        <button type="button" class="notaire-app-cancel">Cancelar</button>
                        <button type="button" class="notaire-app-confirm"></button>
                    </div>
                </div>
            `;
            document.body.appendChild(dialog);
        }

        return new Promise(resolve => {
            const cancelButton = dialog.querySelector('.notaire-app-cancel');
            const confirmButton = dialog.querySelector('.notaire-app-confirm');
            dialog.querySelector('.notaire-app-title').textContent = title;
            dialog.querySelector('.notaire-app-message').textContent = message;
            dialog.querySelector('.notaire-app-icon i').className = `fas ${icon}`;
            cancelButton.hidden = !cancelText;
            cancelButton.textContent = cancelText || 'Cancelar';
            confirmButton.textContent = confirmText;
            cancelButton.onclick = () => dialog.close('cancel');
            confirmButton.onclick = () => dialog.close('confirm');
            dialog.addEventListener('close', () => resolve(dialog.returnValue === 'confirm'), { once: true });
            dialog.showModal();
            (cancelText ? cancelButton : confirmButton).focus();
        });
    }

    window.notaireConfirm = (message, options = {}) => showNotaireDialog({
        title: options.title || 'Confirmar acción',
        message,
        confirmText: options.confirmText || 'Confirmar',
        cancelText: options.cancelText || 'Cancelar',
        icon: options.icon || 'fa-circle-question'
    });

    window.notaireAlert = (message, options = {}) => showNotaireDialog({
        title: options.title || 'Notaire',
        message,
        confirmText: options.confirmText || 'Aceptar',
        icon: options.icon || 'fa-circle-info'
    });

    function showLogoutDialog() {
        return showNotaireDialog({
            title: 'Cerrar sesión',
            message: '¿Quieres cerrar tu sesión de Notaire en este dispositivo?',
            confirmText: 'Cerrar sesión',
            cancelText: 'Cancelar',
            icon: 'fa-right-from-bracket'
        });
    }

    window.logout = async function() {
        if (!await showLogoutDialog()) return;
        try {
            await fetch('/api/auth/logout', { method: 'POST' });
        } catch (error) {
            console.warn('Logout API no disponible:', error);
        }
        clearSessionAndRedirect();
    };

    window.openPasswordChangeDialog = function() {
        let dialog = document.getElementById('notairePasswordDialog');
        if (!dialog) {
            const styles = document.createElement('style');
            styles.textContent = `
                .notaire-password-dialog {
                    position: fixed;
                    inset: 0;
                    margin: auto;
                    width: min(440px, calc(100vw - 32px));
                    max-height: min(90vh, 720px);
                    padding: 0;
                    overflow: auto;
                    color: var(--color-text-main, #f4f1fa);
                    background: var(--color-card-bg, #171321);
                    border: 1px solid var(--color-card-border, rgba(168, 85, 247, .28));
                    border-radius: 20px;
                    box-shadow: 0 24px 70px rgba(0, 0, 0, .55);
                    font: 400 14px/1.5 Outfit, sans-serif;
                }
                .notaire-password-dialog::backdrop {
                    background: rgba(8, 6, 14, .7);
                    backdrop-filter: blur(5px);
                }
                .notaire-password-content { padding: 24px; }
                .notaire-password-heading { display: flex; align-items: center; gap: 14px; margin-bottom: 8px; }
                .notaire-password-icon {
                    display: grid;
                    width: 44px;
                    height: 44px;
                    flex: 0 0 44px;
                    place-items: center;
                    border-radius: 14px;
                    background: rgba(var(--color-primary-rgb, 140, 0, 255), .16);
                    color: var(--color-primary, var(--primary, #c77aff));
                    font-size: 19px;
                }
                .notaire-password-title { margin: 0; color: inherit; font-size: 19px; font-weight: 600; }
                .notaire-password-description { margin: 0 0 20px 58px; color: var(--color-text-muted, #b8b2c4); }
                .notaire-password-field { display: block; margin-top: 14px; color: inherit; font-size: 13px; font-weight: 500; }
                .notaire-password-field input {
                    display: block;
                    width: 100%;
                    min-height: 46px;
                    margin-top: 7px;
                    padding: 10px 13px;
                    color: inherit;
                    background: var(--color-input-bg, rgba(0, 0, 0, .24));
                    border: 1px solid var(--color-card-border, rgba(255, 255, 255, .14));
                    border-radius: 11px;
                    font: inherit;
                }
                .notaire-password-field input:focus { outline: 2px solid var(--color-primary, var(--primary, #a855f7)); outline-offset: 1px; }
                .notaire-password-status { margin: 14px 0 0; color: var(--color-text-muted, #b8b2c4); }
                .notaire-password-status.is-error { color: #ff9a9a; }
                .notaire-password-status[hidden] { display: none; }
                .notaire-password-actions { display: flex; justify-content: flex-end; gap: 10px; margin-top: 22px; }
                .notaire-password-actions button {
                    min-height: 42px;
                    padding: 0 16px;
                    border: 1px solid var(--color-card-border, rgba(255, 255, 255, .14));
                    border-radius: 11px;
                    color: inherit;
                    background: transparent;
                    font: inherit;
                    font-weight: 500;
                    cursor: pointer;
                }
                .notaire-password-actions .notaire-password-submit {
                    border-color: transparent;
                    background: linear-gradient(135deg, var(--color-primary, var(--primary, #8c00ff)), var(--color-secondary, #8b008b));
                    color: #fff;
                }
                .notaire-password-actions button:disabled { cursor: wait; opacity: .7; }
                @media (max-width: 480px) {
                    .notaire-password-content { padding: 20px; }
                    .notaire-password-description { margin-left: 0; }
                    .notaire-password-actions button { flex: 1; }
                }
            `;
            document.head.appendChild(styles);
            dialog = document.createElement('dialog');
            dialog.id = 'notairePasswordDialog';
            dialog.className = 'notaire-password-dialog';
            dialog.setAttribute('aria-labelledby', 'notairePasswordTitle');
            dialog.innerHTML = `
                <form class="notaire-password-content" id="notairePasswordForm">
                    <div class="notaire-password-heading">
                        <span class="notaire-password-icon" aria-hidden="true"><i class="fas fa-lock"></i></span>
                        <h2 class="notaire-password-title" id="notairePasswordTitle">Cambiar contraseña</h2>
                    </div>
                    <p class="notaire-password-description">Elige una contraseña nueva de al menos 8 caracteres.</p>
                    <label class="notaire-password-field" for="notaireNewPassword">
                        Nueva contraseña
                        <input id="notaireNewPassword" type="password" minlength="8" autocomplete="new-password" required>
                    </label>
                    <label class="notaire-password-field" for="notaireConfirmPassword">
                        Confirmar contraseña
                        <input id="notaireConfirmPassword" type="password" minlength="8" autocomplete="new-password" required>
                    </label>
                    <p class="notaire-password-status" id="notairePasswordStatus" role="status" aria-live="polite" hidden></p>
                    <div class="notaire-password-actions">
                        <button type="button" class="notaire-password-cancel">Cancelar</button>
                        <button type="submit" class="notaire-password-submit">Actualizar contraseña</button>
                    </div>
                </form>
            `;
            const passwordForm = dialog.querySelector('#notairePasswordForm');
            const status = dialog.querySelector('#notairePasswordStatus');
            const submit = dialog.querySelector('.notaire-password-submit');
            dialog.querySelector('.notaire-password-cancel').addEventListener('click', () => dialog.close());
            passwordForm.addEventListener('submit', async event => {
                event.preventDefault();
                const newPassword = dialog.querySelector('#notaireNewPassword').value;
                const confirmation = dialog.querySelector('#notaireConfirmPassword').value;
                status.hidden = true;
                status.classList.remove('is-error');

                if (newPassword.length < 8) {
                    status.textContent = 'La contraseña debe tener al menos 8 caracteres.';
                    status.classList.add('is-error');
                    status.hidden = false;
                    return;
                }
                if (newPassword !== confirmation) {
                    status.textContent = 'Las contraseñas no coinciden.';
                    status.classList.add('is-error');
                    status.hidden = false;
                    return;
                }

                const token = localStorage.getItem('notaire_token');
                if (!token) {
                    status.textContent = 'Tu sesión expiró. Vuelve a iniciar sesión e inténtalo de nuevo.';
                    status.classList.add('is-error');
                    status.hidden = false;
                    return;
                }

                submit.disabled = true;
                submit.textContent = 'Actualizando...';
                try {
                    const response = await fetch('/api/auth/password', {
                        method: 'PUT',
                        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                        body: JSON.stringify({ password: newPassword })
                    });
                    const body = await response.text();
                    let result;
                    try {
                        result = body ? JSON.parse(body) : {};
                    } catch {
                        throw new Error('El servidor devolvió una respuesta no válida. Inténtalo de nuevo.');
                    }
                    if (!response.ok) throw new Error(result.detalle || result.error || 'No se pudo actualizar la contraseña.');

                    status.textContent = 'Contraseña actualizada correctamente.';
                    status.hidden = false;
                    passwordForm.reset();
                    dialog.close('updated');
                    if (typeof window.showToast === 'function') window.showToast('Contraseña actualizada correctamente.');
                } catch (error) {
                    status.textContent = error instanceof TypeError
                        ? 'No se pudo conectar con el servidor. Inténtalo de nuevo.'
                        : error instanceof Error ? error.message : 'No se pudo actualizar la contraseña.';
                    status.classList.add('is-error');
                    status.hidden = false;
                } finally {
                    submit.disabled = false;
                    submit.textContent = 'Actualizar contraseña';
                }
            });
            document.body.appendChild(dialog);
        }

        dialog.showModal();
        dialog.querySelector('#notaireNewPassword').focus();
    };
})();
