document.addEventListener('DOMContentLoaded', () => {
    const formRegistro = document.getElementById('formRegistro') || document.getElementById('registerForm') || document.querySelector('form');

    if (!formRegistro) return;

    const passwordInput = document.getElementById('password');
    const meterBars = document.querySelectorAll('#passwordMeter span');
    const message = document.getElementById('registerMessage');
    const button = document.getElementById('registerButton');

    passwordInput?.addEventListener('input', () => {
        const value = passwordInput.value;
        const score = [value.length >= 8, /[A-Z]/.test(value), /\d/.test(value), /[^A-Za-z0-9]/.test(value)].filter(Boolean).length;
        meterBars.forEach((bar, index) => {
            bar.style.background = index < score ? (score < 3 ? '#f59e0b' : '#10b981') : 'rgba(255,255,255,.13)';
        });
    });

    formRegistro.addEventListener('submit', async event => {
        event.preventDefault();

        const nombre = document.getElementById('nombreRegistro')?.value
            || document.getElementById('nombre')?.value
            || document.getElementById('username')?.value;
        const email = document.getElementById('emailRegistro')?.value
            || document.getElementById('email')?.value;
        const telefono = document.getElementById('telefonoRegistro')?.value
            || document.getElementById('telefono')?.value
            || document.getElementById('phone')?.value;
        const password = document.getElementById('passwordRegistro')?.value
            || document.getElementById('password')?.value;
        const confirmPassword = document.getElementById('confirmPassword')?.value;

        if (message) message.textContent = '';
        if (password.length < 8) {
            if (message) message.textContent = 'La contraseña debe tener al menos 8 caracteres.';
            return;
        }
        if (confirmPassword !== undefined && password !== confirmPassword) {
            if (message) message.textContent = 'Las contraseñas no coinciden.';
            return;
        }

        if (button) {
            button.disabled = true;
            button.querySelector('span').textContent = 'Creando cuenta...';
        }

        try {
            const response = await fetch('/api/auth/registro', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ nombre, email, password, telefono })
            });

            const data = await response.json().catch(() => ({}));

            if (!response.ok) {
                throw new Error(data.detalle || data.error || 'Error al registrar usuario');
            }

            localStorage.setItem('notaire_token', data.token);
            if (data.refresh_token) localStorage.setItem('notaire_refresh_token', data.refresh_token);
            if (data.expires_at) localStorage.setItem('notaire_expires_at', String(data.expires_at));
            localStorage.setItem('notaire_user', JSON.stringify(data.usuario));
            localStorage.setItem('user_role', data.usuario.rol || 'cliente');
            localStorage.setItem('user_email', data.usuario.email);
            document.cookie = `user_role=${data.usuario.rol || 'cliente'}; path=/; max-age=86400`;

            window.location.href = '../panel_control/cliente/dashboard.html';
        } catch (error) {
            if (message) message.textContent = error.message || 'No se pudo crear la cuenta.';
            if (button) {
                button.disabled = false;
                button.querySelector('span').textContent = 'Crear cuenta';
            }
        }
    });
});

function togglePassword(inputId, toggleElement) {
    const input = document.getElementById(inputId);
    if (!input) return;

    input.type = input.type === 'password' ? 'text' : 'password';
    toggleElement?.querySelector('i')?.classList.toggle('fa-eye-slash');
}
