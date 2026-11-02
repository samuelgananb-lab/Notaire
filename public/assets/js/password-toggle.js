document.addEventListener('click', event => {
    if (!(event.target instanceof Element)) return;

    const button = event.target.closest('button[data-password-target]');
    if (!button) return;

    const input = document.getElementById(button.dataset.passwordTarget);
    if (!input || input.tagName !== 'INPUT') return;

    const isVisible = input.type === 'password';
    input.type = isVisible ? 'text' : 'password';
    button.setAttribute('aria-pressed', String(isVisible));
    button.setAttribute('aria-label', isVisible ? 'Ocultar contraseña' : 'Mostrar contraseña');

    const icon = button.querySelector('i');
    if (!icon) return;

    icon.classList.toggle('fa-eye', isVisible);
    icon.classList.toggle('fa-eye-slash', !isVisible);
    icon.classList.remove('password-toggle-animate');
    void icon.offsetWidth;
    icon.classList.add('password-toggle-animate');
}, true);
