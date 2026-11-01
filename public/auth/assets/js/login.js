document.addEventListener('DOMContentLoaded', () => {
    
    // 1. Efecto de Viento (Canvas Particles)
    const canvas = document.getElementById('windParticles');
    const ctx = canvas ? canvas.getContext('2d') : null;
    let width, height, particles = [];

    if (canvas && ctx) {
        function resize() {
            width = window.innerWidth; height = window.innerHeight;
            canvas.width = width; canvas.height = height;
            particles = [];
            for(let i=0; i<80; i++) ps();
        }
        function ps() {
            particles.push({
                x: Math.random() * width, y: Math.random() * height,
                s: Math.random() * 1.5 + 0.5, vx: Math.random() * 3 + 2,
                o: Math.random() * 0.3 + 0.05
            });
        }
        function draw() {
            ctx.clearRect(0,0,width,height);
            particles.forEach(p => {
                p.x += p.vx; if(p.x > width + 50) p.x = -50;
                ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(p.x - 15, p.y);
                ctx.strokeStyle = `rgba(255,255,255,${p.o})`; ctx.lineWidth = p.s; ctx.stroke();
            });
            requestAnimationFrame(draw);
        }
        window.addEventListener('resize', resize); resize(); draw();
    }

    // 2. Interactividad Formulario
    const loginForm = document.getElementById('loginForm');
    const togglePass = document.getElementById('togglePassword');
    const passInput = document.getElementById('password');
    const loginBtn = document.getElementById('loginBtn');
    const loginError = document.getElementById('loginError');

    const resetLoginState = () => {
        if (!loginBtn) return;
        loginBtn.disabled = false;
        loginBtn.style.opacity = '1';
        const label = loginBtn.querySelector('span');
        if (label) label.textContent = 'Iniciar Sesión';
        if (document.getElementById('loader')) document.getElementById('loader').style.display = 'none';
    };

    window.addEventListener('pageshow', resetLoginState);

    if (togglePass && passInput) {
        togglePass.addEventListener('click', () => {
            const type = passInput.getAttribute('type') === 'password' ? 'text' : 'password';
            passInput.setAttribute('type', type);
            togglePass.classList.toggle('fa-eye-slash');
        });
    }

    if (loginForm) {
        loginForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const btn = loginBtn;
            if (!btn || btn.disabled) return;
            const email = document.getElementById('email').value.trim().toLowerCase();
            const password = document.getElementById('password').value;
            const loader = document.getElementById('loader');
            const label = btn.querySelector('span');

            if (loginError) {
                loginError.textContent = '';
                loginError.hidden = true;
            }
            btn.disabled = true;
            btn.style.opacity = '0.7';
            if (label) label.textContent = 'Validando...';
            if (loader) loader.style.display = 'block';
            const controller = new AbortController();
            const timeoutId = window.setTimeout(() => controller.abort(), 15000);

            try {
                const response = await fetch('/api/auth/login', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ email, password }),
                    signal: controller.signal
                });
                const data = await parseLoginResponse(response);

                if (!response.ok) {
                    throw new Error(data.error || data.detalle || 'Correo o contraseña incorrectos.');
                }

                const assignedRole = resolveUserRole(data.usuario);
                const dashboardPath = assignedRole === 'cliente'
                    ? '../panel_control/cliente/dashboard.html'
                    : assignedRole === 'empleado'
                        ? '../panel_control/empleado/dashboard.html'
                        : '../panel_control/admin/dashboard.html';
                localStorage.setItem('notaire_token', data.token);
                if (data.refresh_token) localStorage.setItem('notaire_refresh_token', data.refresh_token);
                if (data.expires_at) localStorage.setItem('notaire_expires_at', String(data.expires_at));
                localStorage.setItem('notaire_user', JSON.stringify(data.usuario));
                localStorage.setItem('user_role', assignedRole);
                localStorage.setItem('user_email', data.usuario.email);
                document.cookie = `user_role=${assignedRole}; path=/; max-age=86400`;
                document.cookie = `session_token=${data.token}; path=/; max-age=86400`;

                window.location.href = dashboardPath;
            } catch (error) {
                if (loginError) {
                    loginError.textContent = getLoginErrorMessage(error);
                    loginError.hidden = false;
                } else {
                    console.error('Error de inicio de sesión:', error);
                }
            } finally {
                window.clearTimeout(timeoutId);
                resetLoginState();
            }
        });
    }

    // 3. Efecto 3D Card
    const card = document.querySelector('.login-card');
    if (card) {
        card.addEventListener('mousemove', (e) => {
            const x = (window.innerWidth / 2 - e.pageX) / 25;
            const y = (window.innerHeight / 2 - e.pageY) / 25;
            card.style.transform = `rotateY(${x}deg) rotateX(${y}deg)`;
        });
    }

});

async function parseLoginResponse(response) {
    const body = await response.text();
    if (!body.trim()) {
        throw new Error(`El servidor respondió sin contenido (HTTP ${response.status}).`);
    }

    try {
        return JSON.parse(body);
    } catch {
        throw new Error(`El servidor devolvió una respuesta no válida (HTTP ${response.status}).`);
    }
}

function getLoginErrorMessage(error) {
    if (error?.name === 'AbortError') return 'La solicitud tardó demasiado. Inténtalo de nuevo.';
    const message = String(error?.message || '');
    if (/failed to fetch|networkerror|load failed/i.test(message)) {
        return 'No se pudo conectar con Notaire. Verifica tu conexión e inténtalo de nuevo.';
    }
    if (/credenciales|contraseña|correo/i.test(message)) {
        return 'Correo o contraseña incorrectos.';
    }
    if (/servidor respondió|respuesta no válida|\/api\/auth\/login/i.test(message)) {
        return `${message} Verifica que el servidor esté disponible.`;
    }
    return message || 'No se pudo iniciar sesión. Inténtalo de nuevo.';
}

function resolveUserRole(user = {}) {
    const roleName = String(user.rol || user.nombre_rol || '').trim().toLowerCase();
    if (roleName === 'admin' || roleName === 'cliente' || roleName === 'empleado') return roleName;

    const roleId = String(user.id_rol || '').trim().toLowerCase();
    if (roleId === '1' || roleId === 'admin') return 'admin';
    if (roleId === '3' || roleId === 'empleado') return 'empleado';
    if (roleId === '2' || roleId === 'cliente' || roleId === '11111111-1111-1111-1111-111111111111') {
        return 'cliente';
    }

    throw new Error('El rol de usuario no está habilitado para acceder a un panel');
}

// Helper para autocompletar demo (Global)
function fillText(email, pass) {
    const emailElem = document.getElementById('email');
    const passElem = document.getElementById('password');
    if (emailElem) emailElem.value = email;
    if (passElem) passElem.value = pass;
    
    // Feedback visual pequeño
    const btn = document.getElementById('loginBtn');
    if (btn) {
        btn.classList.add('pulse-once');
        setTimeout(() => btn.classList.remove('pulse-once'), 500);
    }
}

/**
 * Acceso Rápido Demo: autocompleta las credenciales y envía el formulario automáticamente.
 * @param {string} email
 * @param {string} pass
 */
function quickLogin(email, pass) {
    const emailElem = document.getElementById('email');
    const passElem = document.getElementById('password');
    const form = document.getElementById('loginForm');

    if (emailElem) emailElem.value = email;
    if (passElem) passElem.value = pass;

    if (form) {
        // Pequeña animación de feedback antes de enviar
        const clickedBtn = document.activeElement;
        if (clickedBtn && clickedBtn.classList.contains('quick-btn')) {
            const arrow = clickedBtn.querySelector('.quick-btn__arrow');
            if (arrow) {
                arrow.classList.replace('fa-arrow-right', 'fa-spinner');
                arrow.style.animation = 'spin 0.6s linear infinite';
            }
        }
        // Enviar el formulario tras un breve delay para que el usuario vea la acción
        setTimeout(() => form.requestSubmit(), 180);
    }
}
