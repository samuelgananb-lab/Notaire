document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('recoveryForm');
    const submitBtn = document.getElementById('submitBtn');

    if (form && submitBtn) {
        form.addEventListener('submit', async event => {
            event.preventDefault();
            const email = document.getElementById('email').value.trim().toLowerCase();
            const status = document.getElementById('formStatus');
            const result = document.getElementById('recoveryResult');
            submitBtn.disabled = true;
            submitBtn.classList.add('loading');
            status.hidden = true;
            status.textContent = '';
            status.classList.remove('is-error');

            try {
                const response = await fetch('/api/auth/recover', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ email })
                });
                const body = await response.text();
                let payload;
                try {
                    payload = body ? JSON.parse(body) : {};
                } catch {
                    throw new Error('El servidor devolvió una respuesta no válida. Inténtalo de nuevo.');
                }
                if (!response.ok) {
                    throw new Error(payload.error || payload.detalle || 'No se pudo enviar el enlace. Inténtalo de nuevo.');
                }

                form.hidden = true;
                result.hidden = false;
                document.querySelector('.card-header h1').textContent = 'Revisa tu correo';
                document.querySelector('.card-header p').textContent = 'Te enviaremos las instrucciones necesarias para recuperar el acceso a tu cuenta.';
            } catch (error) {
                status.textContent = error instanceof TypeError
                    ? 'No se pudo conectar con el servidor. Comprueba que Notaire esté iniciado e inténtalo de nuevo.'
                    : error instanceof Error
                        ? error.message
                        : 'No se pudo enviar el enlace. Inténtalo de nuevo.';
                status.classList.add('is-error');
                status.hidden = false;
            } finally {
                submitBtn.disabled = false;
                submitBtn.classList.remove('loading');
            }
        });
    }

    const canvas = document.getElementById('windParticles');
    const context = canvas?.getContext('2d');
    const card = document.querySelector('.recovery-card');

    if (canvas && context) {
        let width = 0;
        let height = 0;
        let particles = [];

        function resizeCanvas() {
            width = window.innerWidth;
            height = window.innerHeight;
            canvas.width = width;
            canvas.height = height;
            particles = Array.from({ length: 80 }, () => ({
                x: Math.random() * width,
                y: Math.random() * height,
                speed: Math.random() * 3 + 2,
                size: Math.random() * 1.5 + 0.5,
                opacity: Math.random() * 0.3 + 0.05
            }));
        }

        function animateParticles() {
            context.clearRect(0, 0, width, height);
            particles.forEach(particle => {
                particle.x += particle.speed;
                if (particle.x > width + 50) particle.x = -50;
                context.beginPath();
                context.moveTo(particle.x, particle.y);
                context.lineTo(particle.x - 15, particle.y);
                context.strokeStyle = `rgba(255, 255, 255, ${particle.opacity})`;
                context.lineWidth = particle.size;
                context.stroke();
            });
            window.requestAnimationFrame(animateParticles);
        }

        window.addEventListener('resize', resizeCanvas);
        resizeCanvas();
        animateParticles();
    }

    if (card) {
        card.addEventListener('mousemove', event => {
            const x = (window.innerWidth / 2 - event.pageX) / 25;
            const y = (window.innerHeight / 2 - event.pageY) / 25;
            card.style.transform = `rotateY(${x}deg) rotateX(${y}deg)`;
        });
        card.addEventListener('mouseleave', () => {
            card.style.transform = '';
        });
    }
});
