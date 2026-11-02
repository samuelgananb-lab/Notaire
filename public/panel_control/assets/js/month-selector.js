(function () {
    const chart = window.NotaireFinancialChart;
    const SECTION_KEY = 'notaire_month_return_section';
    if (!chart) return;

    const style = document.createElement('style');
    style.textContent = `
        .month-selector{display:inline-flex;align-items:center;gap:4px;padding:3px 6px;border-radius:12px;
            border:1px solid rgba(120,170,255,.35);background:rgba(10,30,80,.35);color:inherit}
        .month-selector button{border:0;background:transparent;color:inherit;cursor:pointer;padding:4px 8px;border-radius:8px;font-size:.85rem}
        .month-selector button:hover{background:rgba(120,170,255,.25)}
        .month-selector input[type=month]{border:0;background:transparent;color:inherit;font:inherit;font-size:.85rem;
            color-scheme:dark light;outline:none;min-width:130px}
        .month-selector .month-today{font-weight:600;border-left:1px solid rgba(120,170,255,.3);border-radius:0 8px 8px 0}
        .month-selector.is-past{border-color:#f5b942}
        @media (max-width:700px){.month-selector input[type=month]{min-width:110px}}
    `;
    document.head.appendChild(style);

    function shiftMonth(key, delta) {
        const date = new Date(Number(key.slice(0, 4)), Number(key.slice(5, 7)) - 1 + delta, 1);
        return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    }

    function applyMonth(key) {
        chart.setSelectedMonth(key);
        const active = document.querySelector('.content-section.active');
        if (active?.id) sessionStorage.setItem(SECTION_KEY, active.id);
        window.location.reload();
    }

    function build() {
        const host = document.querySelector('.header-actions');
        if (!host || document.getElementById('monthSelector')) return;

        const real = chart.currentMonthKey(new Date());
        const current = chart.currentMonthKey();

        const box = document.createElement('div');
        box.id = 'monthSelector';
        box.className = 'month-selector' + (current !== real ? ' is-past' : '');
        box.title = 'Mes que estás consultando';

        const prev = document.createElement('button');
        prev.type = 'button';
        prev.setAttribute('aria-label', 'Mes anterior');
        prev.innerHTML = '&#9664;';
        const input = document.createElement('input');
        input.type = 'month';
        input.value = current;
        input.setAttribute('aria-label', 'Elegir mes');
        const next = document.createElement('button');
        next.type = 'button';
        next.setAttribute('aria-label', 'Mes siguiente');
        next.innerHTML = '&#9654;';
        const today = document.createElement('button');
        today.type = 'button';
        today.className = 'month-today';
        today.textContent = 'Hoy';

        prev.addEventListener('click', () => applyMonth(shiftMonth(current, -1)));
        next.addEventListener('click', () => applyMonth(shiftMonth(current, 1)));
        today.addEventListener('click', () => { if (current !== real) applyMonth(real); });
        input.addEventListener('change', () => { if (input.value) applyMonth(input.value); });

        box.append(prev, input, next, today);
        host.insertBefore(box, host.firstChild);
    }

    function restoreSection() {
        const id = sessionStorage.getItem(SECTION_KEY);
        if (!id) return;
        sessionStorage.removeItem(SECTION_KEY);
        const link = document.querySelector(`#sidebarMenu a[data-target="${CSS.escape(id)}"]`);
        if (link) setTimeout(() => link.click(), 300);
    }

    document.addEventListener('DOMContentLoaded', () => {
        build();
        restoreSection();
    });
})();
