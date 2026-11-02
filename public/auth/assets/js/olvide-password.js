function initializeRecoveryScreen() {
    const eventController = new AbortController();
    const listenerOptions = { signal: eventController.signal };
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
        }, listenerOptions);
    }

    return () => eventController.abort();
}

window.NotaireAuthScreens = window.NotaireAuthScreens || {};
window.NotaireAuthScreens.recovery = initializeRecoveryScreen;
