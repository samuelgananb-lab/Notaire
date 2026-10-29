document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('changePasswordForm');
    const button = document.getElementById('changePasswordBtn');
    const status = document.getElementById('formStatus');
    const buttonLabel = button?.querySelector('span');

    function showStatus(message, isError = false) {
        status.textContent = message;
        status.classList.toggle('is-error', isError);
        status.hidden = false;
    }

    function getRecoveryToken() {
        const queryParams = new URLSearchParams(window.location.search);
        const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ''));
        return queryParams.get('access_token')
            || hashParams.get('access_token')
            || sessionStorage.getItem('notaire_password_reset_token');
    }

    const token = getRecoveryToken();
    if (token) sessionStorage.setItem('notaire_password_reset_token', token);
    else showStatus('El enlace de recuperación no es válido o ya expiró. Solicita uno nuevo.', true);

    form?.addEventListener('submit', async event => {
        event.preventDefault();
        status.hidden = true;
        status.textContent = '';
        status.classList.remove('is-error');

        const password = document.getElementById('password').value;
        const confirmation = document.getElementById('confirmPassword').value;
        if (password.length < 8 || password !== confirmation) {
            showStatus(password.length < 8
                ? 'La contraseña debe tener al menos 8 caracteres.'
                : 'Las contraseñas no coinciden.', true);
            return;
        }

        const recoveryToken = getRecoveryToken();
        if (!recoveryToken) {
            showStatus('El enlace de recuperación no es válido o ya expiró. Solicita uno nuevo.', true);
            return;
        }

        button.disabled = true;
        button.classList.add('loading');
        if (buttonLabel) buttonLabel.textContent = 'Actualizando contraseña...';

        try {
            const response = await fetch('/api/auth/password', {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${recoveryToken}`
                },
                body: JSON.stringify({ password })
            });
            const body = await response.text();
            let result;
            try {
                result = body ? JSON.parse(body) : {};
            } catch {
                throw new Error('El servidor devolvió una respuesta no válida. Inténtalo de nuevo.');
            }
            if (!response.ok) {
                if (response.status === 401 || response.status === 403) {
                    throw new Error('El enlace de recuperación expiró o ya fue utilizado. Solicita uno nuevo.');
                }
                throw new Error(result.detalle || result.error || 'No se pudo cambiar la contraseña. Inténtalo de nuevo.');
            }

            sessionStorage.removeItem('notaire_password_reset_token');
            showStatus('Contraseña actualizada correctamente. Ya puedes iniciar sesión con tu nueva contraseña.');
            form.hidden = true;
        } catch (error) {
            showStatus(error instanceof TypeError
                ? 'No se pudo conectar con el servidor. Comprueba que Notaire esté iniciado e inténtalo de nuevo.'
                : error instanceof Error
                    ? error.message
                    : 'No se pudo cambiar la contraseña. Inténtalo de nuevo.', true);
            button.disabled = false;
            button.classList.remove('loading');
            if (buttonLabel) buttonLabel.textContent = 'Actualizar contraseña';
        }
    });
});
