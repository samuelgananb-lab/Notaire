document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('changePasswordForm');
    const button = document.getElementById('changePasswordBtn');

    form?.addEventListener('submit', async event => {
        event.preventDefault();
        const password = document.getElementById('password').value;
        const confirmation = document.getElementById('confirmPassword').value;
        if (password.length < 8 || password !== confirmation) {
            window.alert(password.length < 8 ? 'La contraseña debe tener al menos 8 caracteres.' : 'Las contraseñas no coinciden.');
            return;
        }

        const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ''));
        const token = hashParams.get('access_token') || localStorage.getItem('notaire_token');
        if (!token) {
            window.alert('El enlace de recuperación no es válido o ya expiró.');
            return;
        }

        button.disabled = true;
        try {
            const response = await fetch('/api/auth/password', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                body: JSON.stringify({ password })
            });
            const result = await response.json().catch(() => ({}));
            if (!response.ok) throw new Error(result.detalle || result.error || 'No se pudo cambiar la contraseña');
            window.alert('Contraseña actualizada correctamente.');
            window.location.href = 'login.html';
        } catch (error) {
            window.alert(error.message);
            button.disabled = false;
        }
    });
});
