document.addEventListener('DOMContentLoaded', () => {
    // Nav Bar Scroll Effect
    const header = document.getElementById('mainHeader');
    window.addEventListener('scroll', () => {
        if(window.scrollY > 50) { header.classList.add('scrolled'); } 
        else { header.classList.remove('scrolled'); }
    });

    // Interaction Observer for Fade-In Animations
    const observerOptions = { root: null, rootMargin: '0px', threshold: 0.15 };
    const observer = new IntersectionObserver((entries, observer) => {
        entries.forEach(entry => {
            if(entry.isIntersecting) {
                entry.target.classList.add('visible');
                observer.unobserve(entry.target);
            }
        });
    }, observerOptions);

    const animatedElements = document.querySelectorAll('.fade-in-up');
    animatedElements.forEach(el => observer.observe(el));

    // Particle Animation Canvas (from Login)
    const canvas = document.getElementById('windCanvas');
    if(canvas) {
        const ctx = canvas.getContext('2d');
        let cw = window.innerWidth;
        let ch = window.innerHeight;
        canvas.width = cw;
        canvas.height = ch;

        window.addEventListener('resize', () => {
            cw = window.innerWidth;
            ch = window.innerHeight;
            canvas.width = cw;
            canvas.height = ch;
        });

        const particlesArray = [];
        const numberOfParticles = 120; // Slightly fewer for landing page

        class Particle {
            constructor() {
                this.x = Math.random() * cw;
                this.y = Math.random() * ch;
                this.size = Math.random() * 2 + 1;
                this.speedX = Math.random() * 3 + 1;
                this.speedY = Math.random() * -1 - 0.5;
                const hue = Math.floor(Math.random() * 40) + 290;
                const lightness = Math.floor(Math.random() * 20) + 50;
                const alpha = Math.random() * 0.5 + 0.1;
                this.color = `hsla(${hue}, 100%, ${lightness}%, ${alpha})`;
                this.history = [];
                this.maxHistory = Math.floor(Math.random() * 10) + 5;
            }
            update() {
                this.x += this.speedX;
                this.y += this.speedY;
                this.history.push({ x: this.x, y: this.y });
                if (this.history.length > this.maxHistory) this.history.shift();
                if (this.x > cw) { this.x = -10; this.y = Math.random() * ch; this.history = []; }
                if (this.y < 0) { this.x = Math.random() * cw; this.y = ch + 10; this.history = []; }
            }
            draw() {
                if(this.history.length > 1) {
                    ctx.beginPath();
                    ctx.moveTo(this.history[0].x, this.history[0].y);
                    for(let i = 1; i < this.history.length; i++) ctx.lineTo(this.history[i].x, this.history[i].y);
                    ctx.strokeStyle = this.color; ctx.lineWidth = this.size * 0.5; ctx.lineCap = 'round'; ctx.stroke();
                }
                ctx.beginPath();
                ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
                ctx.fillStyle = this.color; ctx.fill();
                ctx.shadowBlur = 15; ctx.shadowColor = this.color;
            }
        }
        function init() { for (let i = 0; i < numberOfParticles; i++) particlesArray.push(new Particle()); }
        function animate() {
            ctx.clearRect(0, 0, cw, ch);
            for (let i = 0; i < particlesArray.length; i++) { particlesArray[i].update(); particlesArray[i].draw(); }
            requestAnimationFrame(animate);
        }
        init();
        animate();
    }
});
