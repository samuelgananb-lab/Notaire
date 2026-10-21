(() => {
    const TYPES = { reporte_error: 'Reporte de error', solicitud_permiso: 'Solicitud', solicitud_soporte: 'Soporte / ayuda', otro: 'Otro' };
    const STATES = { abierta: 'Abierta', en_proceso: 'En proceso', resuelta: 'Resuelta', rechazada: 'Rechazada' };

    const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    const headers = () => ({ 'Content-Type': 'application/json', Authorization: `Bearer ${localStorage.getItem('notaire_token') || ''}` });

    function setMessage(text, ok) {
        const box = document.getElementById('clienteSolMsg');
        box.textContent = text;
        box.className = `cli-sol-msg ${ok ? 'ok' : 'error'}`;
    }

    async function load() {
        const list = document.getElementById('clienteSolList');
        if (!list) return;
        try {
            const response = await fetch('/api/solicitudes', { headers: headers() });
            const result = await response.json().catch(() => []);
            if (!response.ok) throw new Error(result.error || 'No se pudieron cargar tus solicitudes');
            list.innerHTML = result.length
                ? result.map(item => `
                    <article class="cli-sol-item">
                        <header>
                            <strong>${esc(item.asunto)}</strong>
                            <span class="cli-sol-badge ${esc(item.estado)}">${esc(STATES[item.estado] || item.estado)}</span>
                        </header>
                        <small>${esc(TYPES[item.tipo] || item.tipo)} · Prioridad ${esc(item.prioridad)} · ${esc(new Date(item.created_at).toLocaleString('es-CO'))}</small>
                        <p>${esc(item.descripcion)}</p>
                        ${item.respuesta ? `<p class="cli-sol-reply"><b>Respuesta:</b> ${esc(item.respuesta)}</p>` : ''}
                    </article>`).join('')
                : '<p>Aún no has enviado solicitudes.</p>';
        } catch (error) {
            list.innerHTML = `<p class="cli-sol-msg error">${esc(error.message)}</p>`;
        }
    }

    async function submit(event) {
        event.preventDefault();
        const button = event.target.querySelector('button[type="submit"]');
        button.disabled = true;
        try {
            const response = await fetch('/api/solicitudes', {
                method: 'POST',
                headers: headers(),
                body: JSON.stringify({
                    tipo: document.getElementById('clienteSolTipo').value,
                    prioridad: document.getElementById('clienteSolPrioridad').value,
                    asunto: document.getElementById('clienteSolAsunto').value.trim(),
                    descripcion: document.getElementById('clienteSolDescripcion').value.trim()
                })
            });
            const result = await response.json().catch(() => ({}));
            if (!response.ok) throw new Error(result.error || 'No se pudo enviar la solicitud');
            event.target.reset();
            setMessage('Solicitud enviada. Te responderemos pronto.', true);
            await load();
        } catch (error) {
            setMessage(error.message, false);
        } finally {
            button.disabled = false;
        }
    }

    document.addEventListener('DOMContentLoaded', () => {
        document.getElementById('clienteSolForm')?.addEventListener('submit', submit);
        document.querySelector('a[data-target="view-solicitudes"]')?.addEventListener('click', load);
        load();
    });
})();
