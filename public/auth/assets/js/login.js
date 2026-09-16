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

    if (togglePass && passInput) {
        togglePass.addEventListener('click', () => {
            const type = passInput.getAttribute('type') === 'password' ? 'text' : 'password';
            passInput.setAttribute('type', type);
            togglePass.classList.toggle('fa-eye-slash');
        });
    }

    const DEMO_USERS = {
        'admin@notaire.com': { password: 'admin123', role: 'admin', redirect: '../panel_control/admin/dashboard.html' },
        'cliente@notaire.com': { password: 'cliente123', role: 'cliente', redirect: '../panel_control/cliente/dashboard.html' }
    };

    if (loginForm) {
        loginForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const btn = document.getElementById('loginBtn');
            const email = document.getElementById('email').value.trim().toLowerCase();
            const password = document.getElementById('password').value;
            const loader = document.getElementById('loader');
            
            btn.disabled = true;
            btn.style.opacity = '0.7';
            if (btn.querySelector('span')) {
                btn.querySelector('span').innerText = 'Validando...';
            }
            if (loader) loader.style.display = 'block';
            
            let authenticated = false;
            let targetRedirect = '';
            let assignedRole = '';

            try {
                const response = await fetch('/api/auth/login', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ email, password })
                });

                if (response.ok) {
                    const data = await response.json();
                    if (data.success) {
                        authenticated = true;
                        assignedRole = data.role;
                        targetRedirect = data.redirect || '../panel_control/admin/dashboard.html';
                    } else {
                        alert(`⚠️ ${data.message || 'Credenciales incorrectas'}. Por favor, usa los usuarios demo indicados abajo.`);
                    }
                } else {
                    throw new Error('Servidor no devolvió respuesta OK');
                }
            } catch (error) {
                console.warn('Backend API no disponible o ejecutando sin servidor Node Express. Verificando usuarios demo localmente...', error);
                
                // Fallback local para desarrollo o vista previa estática
                const demo = DEMO_USERS[email];
                if (demo && demo.password === password) {
                    authenticated = true;
                    assignedRole = demo.role;
                    targetRedirect = demo.redirect;
                } else {
                    alert('⚠️ Credenciales incorrectas. Por favor, usa los usuarios demo indicados abajo.');
                }
            }

            if (authenticated) {
                // Guardar la sesión tanto en Cookie como en LocalStorage para máxima compatibilidad
                document.cookie = `user_role=${assignedRole}; path=/; max-age=3600`;
                document.cookie = `session_token=sess_local_${Date.now()}_auth_${email}; path=/; max-age=3600`;
                localStorage.setItem('user_role', assignedRole);
                localStorage.setItem('user_email', email);

                window.location.href = targetRedirect;
            } else {
                btn.disabled = false;
                btn.style.opacity = '1';
                if (btn.querySelector('span')) {
                    btn.querySelector('span').innerText = 'Iniciar Sesión';
                }
                if (loader) loader.style.display = 'none';
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
