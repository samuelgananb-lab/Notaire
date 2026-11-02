(() => {
    const root = document.getElementById('authApp');
    const background = document.querySelector('.background-shapes');
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
    const screenInitializers = window.NotaireAuthScreens || {};
    const loadedScripts = new Set();
    let activeScreenCleanup = null;
    let frameId = 0;
    let refreshBackground = () => {};

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
            const streakCount = Math.min(14, Math.max(8, Math.round(window.innerWidth / 130)));
            streaks.length = 0;
            particles.length = 0;
            for (let index = 0; index < streakCount; index += 1) {
                streaks.push({
                    x: Math.random() * width,
                    y: Math.random() * height,
                    length: 22 + Math.random() * 32,
                    direction: 1,
                    opacity: .16 + Math.random() * .1,
                    curve: 2 + Math.random() * 6,
                    delay: index === 0 ? 0 : index / streakCount * 4200 + Math.random() * 350,
                    elapsed: index === 0 ? 1200 : 0,
                    duration: 2800 + Math.random() * 2200,
                    phase: Math.random() * Math.PI * 2,
                    phaseSpeed: .00035 + Math.random() * .00055
                });
            }
            for (let index = 0; index < 22; index += 1) {
                particles.push({
                    x: Math.random() * width,
                    y: Math.random() * height,
                    radius: .65 + Math.random() * .9,
                    glowRadius: 9 + Math.random() * 15,
                    speedX: (Math.random() - .5) * .12,
                    speedY: (Math.random() - .5) * .09,
                    opacity: .12 + Math.random() * .2,
                    phase: Math.random() * Math.PI * 2,
                    phaseSpeed: .00045 + Math.random() * .0008
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
            if (document.hidden) {
                frameId = 0;
                return;
            }
            if (timestamp - lastFrameTime >= 33) {
                const delta = lastFrameTime ? Math.min(timestamp - lastFrameTime, 66) : 33;
                lastFrameTime = timestamp;
                context.clearRect(0, 0, width, height);
                streaks.forEach(streak => {
                    let alpha;
                    if (streak.delay > 0) {
                        streak.delay -= delta;
                        return;
                    }
                    streak.elapsed += delta;
                    if (streak.elapsed >= streak.duration) {
                        streak.elapsed = 0;
                        streak.delay = 900 + Math.random() * 2800;
                        streak.duration = 2800 + Math.random() * 2200;
                        streak.y = Math.random() * height;
                        return;
                    }
                    const progress = streak.elapsed / streak.duration;
                    streak.x = -streak.length + progress * (width + streak.length * 2);
                    alpha = streak.opacity * Math.min(1, progress / .14, (1 - progress) / .2);
                    streak.phase += streak.phaseSpeed * delta;
                    const trail = context.createLinearGradient(
                        streak.x,
                        streak.y,
                        streak.x - streak.length * streak.direction,
                        streak.y
                    );
                    trail.addColorStop(0, `rgba(255, 255, 255, ${alpha})`);
                    trail.addColorStop(1, 'rgba(255, 255, 255, 0)');
                    context.beginPath();
                    context.moveTo(streak.x, streak.y);
                    context.quadraticCurveTo(
                        streak.x - streak.length * streak.direction * .5,
                        streak.y + Math.sin(streak.phase) * streak.curve,
                        streak.x - streak.length * streak.direction,
                        streak.y
                    );
                    context.strokeStyle = trail;
                    context.lineWidth = .85;
                    context.stroke();
                });
                particles.forEach(particle => {
                    const frameScale = delta / 33;
                    particle.x += particle.speedX * frameScale;
                    particle.y += particle.speedY * frameScale;
                    if (particle.x < -particle.glowRadius) particle.x = width + particle.glowRadius;
                    if (particle.x > width + particle.glowRadius) particle.x = -particle.glowRadius;
                    if (particle.y < -particle.glowRadius) particle.y = height + particle.glowRadius;
                    if (particle.y > height + particle.glowRadius) particle.y = -particle.glowRadius;
                    particle.phase += particle.phaseSpeed * delta;
                    const pulse = Math.max(0, Math.sin(particle.phase));
                    const alpha = particle.opacity * (.08 + .92 * pulse ** 2);
                    const flash = pulse ** 12;
                    const glowSize = particle.glowRadius * (1 + flash * .28);
                    const glow = context.createRadialGradient(
                        particle.x,
                        particle.y,
                        0,
                        particle.x,
                        particle.y,
                        glowSize
                    );
                    glow.addColorStop(0, `rgba(230, 202, 255, ${alpha * (.48 + flash * .32)})`);
                    glow.addColorStop(.22, `rgba(177, 91, 255, ${alpha * (.3 + flash * .4)})`);
                    glow.addColorStop(1, 'rgba(140, 0, 255, 0)');
                    context.fillStyle = glow;
                    context.fillRect(
                        particle.x - glowSize,
                        particle.y - glowSize,
                        glowSize * 2,
                        glowSize * 2
                    );
                    context.beginPath();
                    context.arc(particle.x, particle.y, particle.radius + flash * .35, 0, Math.PI * 2);
                    context.fillStyle = `rgba(244, 232, 255, ${alpha * (.72 + flash * .28)})`;
                    context.fill();
                });
            }
            frameId = window.requestAnimationFrame(drawFrame);
        }

        function startAnimation() {
            if (!frameId && !document.hidden) {
                frameId = window.requestAnimationFrame(drawFrame);
            }
        }

        refreshBackground = () => {
            lastFrameTime = 0;
            seedScene();
            startAnimation();
        };

        function updateMotionPreference() {
            startAnimation();
        }

        window.addEventListener('resize', resizeCanvas, { passive: true });
        document.addEventListener('visibilitychange', startAnimation);
        reduceMotion.addEventListener('change', updateMotionPreference);
        resizeCanvas();
        startAnimation();
    }

    function initializeScreen() {
        activeScreenCleanup?.();
        document.body.classList.toggle('auth-login', root.dataset.authScreen === 'login');
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
        refreshBackground();
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
