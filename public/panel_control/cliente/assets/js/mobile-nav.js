(function () {
    const nav = document.getElementById('mobileBottomNav');
    if (!nav) return;

    const MORE_TARGETS = ['view-ingresos', 'view-calculadora', 'view-recordatorios', 'view-solicitudes', 'view-configuracion'];
    let resizeTimer = null;
    let lastSyncedView = null;

    function currentView() {
        return document.querySelector('.content-section.active')?.id || 'view-inicio';
    }

    function syncActive() {
        const view = currentView();
        nav.querySelectorAll('button[data-nav]').forEach(btn => {
            const target = btn.dataset.nav;
            const active = target === view || (target === 'more' && MORE_TARGETS.includes(view));
            btn.classList.toggle('active', active);
        });
        if (lastSyncedView === view) return;
        const viewChanged = lastSyncedView !== null;
        lastSyncedView = view;
        if (!viewChanged) return;
        window.clearTimeout(resizeTimer);
        resizeTimer = window.setTimeout(() => window.dispatchEvent(new Event('resize')), 150);
    }

    nav.addEventListener('click', event => {
        const btn = event.target.closest('button[data-nav]');
        if (!btn) return;

        if (btn.dataset.nav === 'more') {
            document.getElementById('mobileMenuTrigger')?.click();
            return;
        }

        // Reutiliza el enlace del menú lateral para conservar toda la lógica existente
        document.querySelector(`#sidebarMenu a[data-target="${btn.dataset.nav}"]`)?.click();
        window.scrollTo({ top: 0, behavior: 'smooth' });
    });

    const container = document.getElementById('views-container');
    if (container) {
        container.querySelectorAll('.content-section').forEach(section => {
            new MutationObserver(syncActive).observe(section, {
                attributes: true,
                attributeFilter: ['class']
            });
        });
    }
    syncActive();
})();

(function () {
    const pctEl = document.getElementById('valPresupuestoPct');
    const view = document.getElementById('view-gastos');
    if (!pctEl || !view) return;
    const card = document.getElementById('valGastadoEsteMes')?.closest('.metric-card');
    if (!card) return;
    function syncRing() {
        const pct = Math.max(0, Math.min(100, parseFloat((pctEl.textContent || '').replace(',', '.')) || 0));
        card.style.setProperty('--pct', pct);
        card.dataset.pct = Math.round(pct) + '%';
    }
    new MutationObserver(syncRing).observe(pctEl, { childList: true, characterData: true, subtree: true });
    syncRing();
})();

(function () {
    const src = document.getElementById('saldo-disponible');
    const section = document.getElementById('seccion-saldo');
    if (!src || !section) return;
    const hero = document.createElement('div');
    hero.className = 'saldo-hero-mobile';
    hero.innerHTML = '<small>Liquidez disponible</small><strong id="saldoHeroValor">$0</strong>';
    section.parentNode.insertBefore(hero, section);
    const sync = () => { hero.querySelector('strong').textContent = src.textContent; };
    new MutationObserver(sync).observe(src, { childList: true, characterData: true, subtree: true });
    sync();
})();
