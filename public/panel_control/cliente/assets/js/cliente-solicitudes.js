(() => {
    const TYPES = { reporte_error: 'Reporte de error', solicitud_permiso: 'Solicitud', solicitud_soporte: 'Soporte / ayuda', otro: 'Otro' };
    const STATES = { abierta: 'Abierta', en_proceso: 'En proceso', resuelta: 'Resuelta', rechazada: 'Rechazada' };
    const PRIORITIES = { baja: 'Baja', media: 'Media', alta: 'Alta' };
    let solicitudesCargadas = false;
    let solicitudEnCurso = null;
    let solicitudes = [];
    let editingId = null;

    const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    const headers = () => ({ 'Content-Type': 'application/json', Authorization: `Bearer ${localStorage.getItem('notaire_token') || ''}` });

    async function authenticatedFetch(url, options = {}) {
        if (window.notaireSessionReady && !await window.notaireSessionReady) {
            throw new Error('Tu sesión expiró. Inicia sesión nuevamente.');
        }

        const send = () => fetch(url, { ...options, headers: { ...options.headers, ...headers() } });
        let response = await send();
        if (response.status !== 401 && response.status !== 403) return response;

        const failure = await response.clone().json().catch(() => ({}));
        if (
            response.status !== 401 &&
            !/token|expirad|sesión/i.test(String(failure.error || ''))
        ) return response;

        if (typeof window.notaireRefreshSession !== 'function') return response;
        await window.notaireRefreshSession();
        return send();
    }

    function setMessage(text, ok) {
        const box = document.getElementById('clienteSolMsg');
        if (!box) return;
        box.textContent = window.translateText?.(text) || text;
        box.className = `cli-sol-msg ${ok ? 'ok' : 'error'}`;
    }

    function optionMarkup(options, selected) {
        return Object.entries(options).map(([value, label]) =>
            `<option value="${value}"${value === selected ? ' selected' : ''}>${esc(label)}</option>`
        ).join('');
    }

    function renderEditForm(item) {
        return `
            <form class="cli-sol-edit-form" data-solicitud-id="${esc(item.id)}">
                <label><span>Tipo</span><select name="tipo" required>${optionMarkup(TYPES, item.tipo)}</select></label>
                <label><span>Prioridad</span><select name="prioridad" required>${optionMarkup(PRIORITIES, item.prioridad)}</select></label>
                <label class="wide"><span>Asunto</span><input name="asunto" required maxlength="180" value="${esc(item.asunto)}"></label>
                <label class="wide"><span>Descripción</span><textarea name="descripcion" rows="4" required>${esc(item.descripcion)}</textarea></label>
                <div class="cli-sol-edit-actions wide">
                    <button class="cli-sol-action cli-sol-action-secondary" type="button" data-solicitud-action="cancel">Cancelar</button>
                    <button class="cli-sol-action cli-sol-action-primary" type="submit" data-solicitud-action="save"><i class="fas fa-check" aria-hidden="true"></i> Guardar cambios</button>
                </div>
            </form>`;
    }

    function renderSolicitud(item) {
        const editable = item.estado === 'abierta';
        const editing = String(editingId) === String(item.id) && editable;
        const state = Object.prototype.hasOwnProperty.call(STATES, item.estado) ? item.estado : 'abierta';
        const actions = editable ? `
            <div class="cli-sol-actions">
                <button class="cli-sol-action cli-sol-action-secondary" type="button" data-solicitud-action="edit" aria-expanded="${editing}">
                    <i class="fas ${editing ? 'fa-xmark' : 'fa-pen-to-square'}" aria-hidden="true"></i> ${editing ? 'Cerrar edición' : 'Editar'}
                </button>
                <button class="cli-sol-action cli-sol-action-danger" type="button" data-solicitud-action="delete">
                    <i class="fas fa-trash-can" aria-hidden="true"></i> Eliminar
                </button>
            </div>` : '';

        return `
            <article class="cli-sol-item" data-solicitud-id="${esc(item.id)}">
                <header>
                    <strong data-user-content="true">${esc(item.asunto)}</strong>
                    <span class="cli-sol-badge ${state}">${esc(STATES[item.estado] || item.estado)}</span>
                </header>
                <small>${esc(TYPES[item.tipo] || item.tipo)} · Prioridad ${esc(PRIORITIES[item.prioridad] || item.prioridad)} · ${esc(new Date(item.created_at).toLocaleString('es-CO'))}</small>
                <p data-user-content="true">${esc(item.descripcion)}</p>
                ${item.respuesta ? `<p class="cli-sol-reply"><b>Respuesta:</b> <span data-user-content="true">${esc(item.respuesta)}</span></p>` : ''}
                ${actions}
                ${editing ? renderEditForm(item) : ''}
            </article>`;
    }

    function renderSolicitudes() {
        const list = document.getElementById('clienteSolList');
        if (!list) return;
        list.innerHTML = solicitudes.length
            ? solicitudes.map(renderSolicitud).join('')
            : '<div class="cli-sol-empty"><i class="fas fa-inbox" aria-hidden="true"></i><strong>Aún no has enviado solicitudes.</strong><p>Cuando envíes una, podrás seguir su estado y respuesta aquí.</p></div>';
        window.translateStaticContent?.(window.getCurrentLang?.() || 'es');
    }

    async function readResponse(response, fallback) {
        let result;
        try {
            result = await response.json();
        } catch {
            throw new Error(response.ok ? 'El servidor devolvió una respuesta inválida' : fallback);
        }
        if (!response.ok) throw new Error(result && typeof result === 'object' ? result.error || fallback : fallback);
        if (!result || typeof result !== 'object') throw new Error('El servidor devolvió una respuesta inválida');
        return result;
    }

    async function load(force = false) {
        if (solicitudEnCurso) {
            if (!force) return solicitudEnCurso;
            await solicitudEnCurso;
        }
        if (solicitudesCargadas && !force) return;
        const list = document.getElementById('clienteSolList');
        if (!list) return;
        solicitudEnCurso = (async () => {
            try {
                const response = await authenticatedFetch('/api/solicitudes');
                const result = await readResponse(response, 'No se pudieron cargar tus solicitudes');
                if (!Array.isArray(result)) throw new Error('La respuesta de solicitudes no es válida');
                solicitudes = result.slice(0, 2);
                solicitudesCargadas = true;
                if (!solicitudes.some(item => String(item.id) === String(editingId) && item.estado === 'abierta')) editingId = null;
                renderSolicitudes();
            } catch (error) {
                solicitudesCargadas = false;
                list.innerHTML = `<p class="cli-sol-msg error">${esc(error.message)}</p>`;
            } finally {
                solicitudEnCurso = null;
            }
        })();
        return solicitudEnCurso;
    }

    async function submit(event) {
        event.preventDefault();
        const form = event.target;
        const button = form.querySelector('button[type="submit"]');
        button.disabled = true;
        try {
            const response = await authenticatedFetch('/api/solicitudes', {
                method: 'POST',
                body: JSON.stringify({
                    tipo: document.getElementById('clienteSolTipo').value,
                    prioridad: document.getElementById('clienteSolPrioridad').value,
                    asunto: document.getElementById('clienteSolAsunto').value.trim(),
                    descripcion: document.getElementById('clienteSolDescripcion').value.trim()
                })
            });
            const result = await readResponse(response, 'No se pudo enviar la solicitud');
            if (!result.id) throw new Error('El servidor no confirmó el envío de la solicitud');
            form.reset();
            editingId = null;
            setMessage('Solicitud enviada. Te responderemos pronto.', true);
            await load(true);
        } catch (error) {
            setMessage(error.message, false);
        } finally {
            button.disabled = false;
        }
    }

    async function editSolicitud(form) {
        const id = form.dataset.solicitudId;
        const button = form.querySelector('button[type="submit"]');
        button.disabled = true;
        try {
            const response = await authenticatedFetch(`/api/solicitudes/${encodeURIComponent(id)}`, {
                method: 'PATCH',
                body: JSON.stringify({
                    tipo: form.elements.tipo.value,
                    prioridad: form.elements.prioridad.value,
                    asunto: form.elements.asunto.value.trim(),
                    descripcion: form.elements.descripcion.value.trim()
                })
            });
            const result = await readResponse(response, 'No se pudo actualizar la solicitud');
            if (!result.id) throw new Error('El servidor no confirmó los cambios de la solicitud');
            editingId = null;
            setMessage('Solicitud actualizada correctamente.', true);
            await load(true);
        } catch (error) {
            setMessage(error.message, false);
        } finally {
            button.disabled = false;
        }
    }

    async function deleteSolicitud(item, button) {
        if (typeof window.notaireConfirm !== 'function') {
            setMessage('No se pudo confirmar la eliminación. Inténtalo de nuevo.', false);
            return;
        }
        if (!await window.notaireConfirm(`¿Eliminar la solicitud "${item.asunto}"?`, { title: 'Eliminar solicitud', confirmText: 'Eliminar' })) return;

        button.disabled = true;
        try {
            const response = await authenticatedFetch(`/api/solicitudes/${encodeURIComponent(item.id)}`, {
                method: 'DELETE',
            });
            const result = await readResponse(response, 'No se pudo eliminar la solicitud');
            if (result.ok !== true) throw new Error('El servidor no confirmó la eliminación de la solicitud');
            editingId = null;
            setMessage('Solicitud eliminada correctamente.', true);
            await load(true);
        } catch (error) {
            setMessage(error.message, false);
        } finally {
            button.disabled = false;
        }
    }

    function bindList(list) {
        list.addEventListener('click', event => {
            const button = event.target.closest('button[data-solicitud-action]');
            if (!button) return;
            const article = button.closest('.cli-sol-item');
            const item = solicitudes.find(solicitud => String(solicitud.id) === article?.dataset.solicitudId);
            if (!item || item.estado !== 'abierta') return;

            if (button.dataset.solicitudAction === 'save') {
                const form = button.closest('.cli-sol-edit-form');
                if (!form || !form.reportValidity()) return;
                event.preventDefault();
                void editSolicitud(form);
            } else if (button.dataset.solicitudAction === 'edit') {
                editingId = String(editingId) === String(item.id) ? null : item.id;
                renderSolicitudes();
            } else if (button.dataset.solicitudAction === 'cancel') {
                editingId = null;
                renderSolicitudes();
            } else if (button.dataset.solicitudAction === 'delete') {
                void deleteSolicitud(item, button);
            }
        });
        list.addEventListener('submit', event => {
            const form = event.target.closest('.cli-sol-edit-form');
            if (!form) return;
            event.preventDefault();
            void editSolicitud(form);
        });
    }

    document.addEventListener('DOMContentLoaded', () => {
        document.getElementById('clienteSolForm')?.addEventListener('submit', submit);
        const list = document.getElementById('clienteSolList');
        if (list) bindList(list);
        document.querySelector('a[data-target="view-solicitudes"]')?.addEventListener('click', () => void load());
        if (document.getElementById('view-solicitudes')?.classList.contains('active')) void load();
    });
})();
