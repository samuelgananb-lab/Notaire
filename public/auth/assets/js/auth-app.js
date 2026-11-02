(() => {
    const root = document.getElementById('authApp');
    const background = document.querySelector('.background-shapes');
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
    const screenInitializers = window.NotaireAuthScreens || {};
    const loadedScripts = new Set();
    let activeScreenCleanup = null;
    let frameId = 0;

    if (!root || !background) return;

    function initializeBackground() {
        background.innerHTML = '<div class="shape shape-1"></div><div class="shape shape-2"></div><div class="shape shape-3"></div>';
        const canvas = document.getElementById('windParticles');
        const context = canvas?.getContext('2d', { alpha: true });
        if (!canvas || !context) return;

        const streaks = [];
        const particles = [];
        let width = 0;
        let height = 0;
        let pixelRatio = 1;
        let lastFrameTime = 0;

        function seedScene() {
            const streakCount = Math.min(42, Math.max(22, Math.round(window.innerWidth / 32)));
            streaks.length = 0;
            particles.length = 0;
            for (let index = 0; index < streakCount; index += 1) {
                streaks.push({
                    x: Math.random() * width,
                    y: Math.random() * height,
                    length: 10 + Math.random() * 33,
                    speed: .12 + Math.random() * .35,
                    direction: Math.random() > .17 ? 1 : -1,
                    opacity: .08 + Math.random() * .18,
                    phase: Math.random() * Math.PI * 2,
                    phaseSpeed: .00035 + Math.random() * .00055
                });
            }
            for (let index = 0; index < 12; index += 1) {
                particles.push({
                    x: Math.random() * width,
                    y: Math.random() * height,
                    radius: .5 + Math.random() * .7,
                    opacity: .07 + Math.random() * .12,
                    phase: Math.random() * Math.PI * 2,
                    phaseSpeed: .0004 + Math.random() * .0005
                });
            }
        }

        function resizeCanvas() {
            width = window.innerWidth;
            height = window.innerHeight;
            pixelRatio = Math.min(window.devicePixelRatio || 1, 1.5);
            canvas.width = Math.round(width * pixelRatio);
            canvas.height = Math.round(height * pixelRatio);
            context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
            seedScene();
        }

        function drawFrame(timestamp) {
            if (document.hidden || reduceMotion.matches) {
                frameId = 0;
                return;
            }
            if (timestamp - lastFrameTime >= 33) {
                lastFrameTime = timestamp;
                context.clearRect(0, 0, width, height);
                streaks.forEach(streak => {
                    streak.x += streak.speed * streak.direction;
                    if (streak.direction > 0 && streak.x > width + streak.length) streak.x = -streak.length;
                    if (streak.direction < 0 && streak.x < -streak.length) streak.x = width + streak.length;
                    streak.phase += streak.phaseSpeed * 33;
                    const alpha = streak.opacity * (.48 + .52 * Math.sin(streak.phase) ** 2);
                    context.beginPath();
                    context.moveTo(streak.x, streak.y);
                    context.lineTo(streak.x - streak.length * streak.direction, streak.y);
                    context.strokeStyle = `rgba(218, 188, 255, ${alpha})`;
                    context.lineWidth = .7;
                    context.stroke();
                });
                particles.forEach(particle => {
                    particle.phase += particle.phaseSpeed * 33;
                    const alpha = particle.opacity * (.45 + .55 * Math.sin(particle.phase) ** 2);
                    context.beginPath();
                    context.arc(particle.x, particle.y, particle.radius, 0, Math.PI * 2);
                    context.fillStyle = `rgba(222, 199, 255, ${alpha})`;
                    context.fill();
                });
            }
            frameId = window.requestAnimationFrame(drawFrame);
        }

        function startAnimation() {
            if (!frameId && !document.hidden && !reduceMotion.matches) {
                frameId = window.requestAnimationFrame(drawFrame);
            }
        }

        function updateMotionPreference() {
            if (reduceMotion.matches) {
                window.cancelAnimationFrame(frameId);
                frameId = 0;
                context.clearRect(0, 0, width, height);
            } else {
                startAnimation();
            }
        }

        window.addEventListener('resize', resizeCanvas, { passive: true });
        document.addEventListener('visibilitychange', startAnimation);
        reduceMotion.addEventListener('change', updateMotionPreference);
        resizeCanvas();
        startAnimation();
    }

    function initializeScreen() {
        activeScreenCleanup?.();
        const initialize = screenInitializers[root.dataset.authScreen];
        activeScreenCleanup = typeof initialize === 'function' ? initialize() || null : null;
    }

    function loadScreenScript(url) {
        const scriptUrl = new URL(url, window.location.href).href;
        if (loadedScripts.has(scriptUrl)) return Promise.resolve();

        return new Promise((resolve, reject) => {
            const script = document.createElement('script');
            script.src = scriptUrl;
            script.dataset.authScreenScript = '';
            script.onload = () => {
                loadedScripts.add(scriptUrl);
                resolve();
            };
            script.onerror = () => reject(new Error(`No se pudo cargar el formulario solicitado: ${scriptUrl}`));
            document.head.append(script);
        });
    }

    async function navigateTo(url, addHistory = true) {
        const target = new URL(url, window.location.href);
        if (target.origin !== window.location.origin) return false;

        const response = await fetch(target.href, { headers: { Accept: 'text/html' } });
        if (!response.ok) throw new Error(`No se pudo abrir la pantalla de autenticación (${response.status}).`);

        const html = await response.text();
        const nextDocument = new DOMParser().parseFromString(html, 'text/html');
        const nextRoot = nextDocument.getElementById('authApp');
        const nextPanel = nextDocument.getElementById('authPanel');
        if (!nextRoot || !nextPanel || !nextRoot.dataset.authScreen || !nextRoot.dataset.authScript) {
            throw new Error('La pantalla solicitada no contiene un formulario de autenticación válido.');
        }
        await loadScreenScript(new URL(nextRoot.dataset.authScript, target.href));

        const currentPanel = document.getElementById('authPanel');
        if (!currentPanel) throw new Error('No se encontró el panel de autenticación actual.');
        if (!reduceMotion.matches) {
            currentPanel.classList.add('is-exiting');
            await new Promise(resolve => window.setTimeout(resolve, 160));
        }
        activeScreenCleanup?.();
        activeScreenCleanup = null;
        currentPanel.replaceWith(document.importNode(nextPanel, true));
        root.dataset.authScreen = nextRoot.dataset.authScreen;
        root.dataset.authScript = nextRoot.dataset.authScript;
        document.title = nextDocument.title;
        if (addHistory) window.history.pushState({}, '', target.href);
        initializeScreen();
        return true;
    }

    function isAuthPage(url) {
        return url.origin === window.location.origin
            && url.pathname.includes('/auth/')
            && /\.html$/i.test(url.pathname);
    }

    document.addEventListener('click', event => {
        if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
        const link = event.target.closest('a[href]');
        if (!link || link.target || link.hasAttribute('download')) return;
        const target = new URL(link.href, window.location.href);
        if (!isAuthPage(target) || target.href === window.location.href) return;

        event.preventDefault();
        navigateTo(target.href).catch(error => {
            console.error('Error al cambiar de pantalla de autenticación:', error);
            window.location.assign(target.href);
        });
    });

    window.addEventListener('popstate', () => {
        if (isAuthPage(new URL(window.location.href))) {
            navigateTo(window.location.href, false).catch(error => {
                console.error('Error al restaurar la pantalla de autenticación:', error);
                window.location.reload();
            });
        }
    });

    const initialScript = document.querySelector('script[data-auth-screen-script]');
    if (initialScript) loadedScripts.add(new URL(initialScript.src, window.location.href).href);
    initializeBackground();
    initializeScreen();
})();
