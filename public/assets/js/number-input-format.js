(function() {
    const numberFormatter = new Intl.NumberFormat('es-CO', {
        useGrouping: true,
        maximumFractionDigits: 2
    });

    function cleanAmount(value) {
        const raw = String(value ?? '').trim().replace(/[^\d.,]/g, '');
        const decimalIndex = raw.lastIndexOf(',');
        const integerPart = (decimalIndex >= 0 ? raw.slice(0, decimalIndex) : raw).replace(/\D/g, '');
        const decimalPart = decimalIndex >= 0 ? raw.slice(decimalIndex + 1).replace(/\D/g, '').slice(0, 2) : null;
        return { integerPart, decimalPart };
    }

    function parseFormattedAmount(value) {
        const { integerPart, decimalPart } = cleanAmount(value);
        if (!integerPart && !decimalPart) return 0;
        return Number(`${integerPart || '0'}${decimalPart === null ? '' : `.${decimalPart}`}`);
    }

    function formatAmountInput(input) {
        if (!input || !input.matches('[data-format-number]')) return;

        const caret = input.selectionStart ?? input.value.length;
        const digitsBeforeCaret = input.value.slice(0, caret).replace(/\D/g, '').length;
        const hadDecimal = input.value.includes(',');
        const { integerPart, decimalPart } = cleanAmount(input.value);
        if (!integerPart && decimalPart === null) {
            input.value = '';
            return;
        }

        const grouped = numberFormatter.format(Number(integerPart || '0')).replace(/,.*$/, '');
        input.value = `${grouped}${hadDecimal ? `,${decimalPart || ''}` : ''}`;
        let nextCaret = 0;
        let digitsSeen = 0;
        while (nextCaret < input.value.length && digitsSeen < digitsBeforeCaret) {
            if (/\d/.test(input.value[nextCaret])) digitsSeen += 1;
            nextCaret += 1;
        }
        if (hadDecimal && caret > 0 && input.value.includes(',') && nextCaret <= input.value.indexOf(',')) {
            nextCaret = input.value.indexOf(',') + 1;
        }
        input.setSelectionRange(nextCaret, nextCaret);
    }

    window.parseFormattedAmount = parseFormattedAmount;
    window.formatAmountInput = formatAmountInput;

    document.addEventListener('input', event => {
        if (event.target.matches('[data-format-number]')) formatAmountInput(event.target);
    });
    document.addEventListener('focusin', event => {
        if (event.target.matches('[data-format-number]')) formatAmountInput(event.target);
    });
    document.addEventListener('focusout', event => {
        if (event.target.matches('[data-format-number]')) formatAmountInput(event.target);
    });
    document.addEventListener('DOMContentLoaded', () => {
        document.querySelectorAll('[data-format-number]').forEach(formatAmountInput);
        document.addEventListener('reset', event => {
            window.setTimeout(() => {
                event.target.querySelectorAll('[data-format-number]').forEach(formatAmountInput);
            });
        }, true);
    });
})();
