document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('recoveryForm');
    const submitBtn = document.getElementById('submitBtn');
    
    // Simulación de interacción al hacer submit del formulario
    form.addEventListener('submit', (e) => {
        e.preventDefault();
        const email = document.getElementById('email').value;
        
        if (email) {
            // 1. Iniciar estado de carga visual en el botón
            submitBtn.classList.add('loading');
            form.querySelector('input').setAttribute('disabled', 'disabled');
            
            // 2. Simular un delay de petición de red (2 segundos)
            setTimeout(() => {
                submitBtn.classList.remove('loading');
                
                // 3. Modificar la UI de la tarjeta para mostrar mensaje de éxito 
                // con transiciones suaves
                const card = document.querySelector('.recovery-card');
                
                card.style.opacity = '0';
                card.style.transform = 'scale(0.9) translateY(20px)';
                card.style.transition = 'all 0.4s cubic-bezier(0.16, 1, 0.3, 1)';
                
                setTimeout(() => {
                    // Contenido actualizado con icono de éxito (check) y degradados correspondientes
                    card.innerHTML = `
                        <div class="card-header" style="margin-bottom: 0;">
                            <div class="icon-wrapper" style="background: linear-gradient(135deg, #22c55e, #16a34a); box-shadow: 0 10px 25px rgba(34, 197, 94, 0.3); animation: none; transform: scale(1.1);">
                                <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                    <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
                                    <polyline points="22 4 12 14.01 9 11.01"></polyline>
                                </svg>
                            </div>
                            <h1 style="font-size: 24px; margin-top: 25px;">¡Enlace enviado!</h1>
                            <p style="margin-top: 15px;">Hemos enviado un enlace seguro para restablecer tu contraseña a:<br><strong style="color: white; font-weight: 600; display: inline-block; margin-top: 5px;">${email}</strong></p>
                            <p style="margin-top: 15px; font-size: 13px; color: rgba(255,255,255,0.5);">Asegúrate de revisar tu bandeja de correo no deseado (spam).</p>
                            
                            <a href="#" onclick="history.back()" class="submit-btn" style="text-decoration: none; margin-top: 30px; border-radius: 14px; position: relative; z-index: 10;">
                                <span>Volver a iniciar sesión</span>
                            </a>
                        </div>
                    `;
                    
                    // Volver a animar la entrada
                    requestAnimationFrame(() => {
                        card.style.opacity = '1';
                        // Usamos transform scale y rotate suave
                        card.style.transform = 'scale(1) translateY(0)';
                    });
                }, 400); // Dar tiempo para que desaparezca la tarjeta
                
            }, 2000); 
        }
    });

    // ==========================================
    // Efecto Premium: Parallax / Inclinación 3D dependiente del ratón
    // (Aumenta mucho la sensación premium del diseño)
    // ==========================================
    const container = document.querySelector('.container');
    const card = document.querySelector('.recovery-card');
    
    // Variables de suavizado y limitación de rotación
    let isHovering = false;
    
    container.addEventListener('mousemove', (e) => {
        if(!isHovering) return;
        
        // Calcular posición del ratón relativa al centro de la tarjeta
        const cardRect = card.getBoundingClientRect();
        const cardCenterX = cardRect.left + cardRect.width / 2;
        const cardCenterY = cardRect.top + cardRect.height / 2;
        
        // Suavizar la rotación (Max 10 grados)
        const xAxis = ((cardCenterY - e.clientY) / cardRect.height) * 15;
        const yAxis = ((e.clientX - cardCenterX) / cardRect.width) * 15;
        
        card.style.transform = `rotateX(${xAxis}deg) rotateY(${yAxis}deg) scale(1.02)`;
    });
    
    container.addEventListener('mouseenter', () => {
        isHovering = true;
        card.style.transition = 'transform 0.1s ease-out';
    });
    
    container.addEventListener('mouseleave', () => {
        isHovering = false;
        card.style.transition = 'transform 0.6s cubic-bezier(0.16, 1, 0.3, 1)';
        card.style.transform = `rotateX(0deg) rotateY(0deg) scale(1)`;
    });

    // ==========================================
    // Efecto de Viento (Partículas Canvas)
    // ==========================================
    const canvas = document.getElementById('windParticles');
    const ctx = canvas.getContext('2d');
    
    let width, height;
    let particles = [];
    
    function resizeCanvas() {
        width = window.innerWidth;
        height = window.innerHeight;
        canvas.width = width;
        canvas.height = height;
        initParticles();
    }
    
    class WindParticle {
        constructor() {
            this.x = Math.random() * width; // Distribución inicial en toda la pantalla
            this.y = Math.random() * height;
            this.size = Math.random() * 1.5 + 0.5; // Tamaño (grosor de la línea)
            // Velocidad rápida horizontal para simular viento (más grandes son más rápidas por paralaje)
            this.speedX = Math.random() * 3 + (this.size * 2) + 1;
            // Ligera desviación en Y
            this.speedY = (Math.random() - 0.5) * 0.5;
            // Opacidad baja para que se vea sutil
            this.opacity = Math.random() * 0.3 + 0.05;
            this.phase = Math.random() * Math.PI * 2;
        }
        
        reset() {
            this.x = -50; 
            this.y = Math.random() * height;
            this.size = Math.random() * 1.5 + 0.5;
            this.speedX = Math.random() * 3 + (this.size * 2) + 1;
            this.speedY = (Math.random() - 0.5) * 0.5;
            this.opacity = Math.random() * 0.3 + 0.05;
        }
        
        update() {
            this.x += this.speedX;
            // Leve ondulación simulando corrientes de aire curvas
            this.y += Math.sin(this.x * 0.003 + this.phase) * 0.5 + this.speedY;
            
            // Si sale de la pantalla por la derecha, reiniciar a la izquierda
            if (this.x > width + 50) {
                this.reset();
            }
        }
        
        draw() {
            ctx.beginPath();
            ctx.moveTo(this.x, this.y);
            // Dibujar una estela (cola) para dar sensación de velocidad y movimiento
            const tailLength = this.speedX * 4; 
            ctx.lineTo(this.x - tailLength, this.y - Math.sin(this.x * 0.003 + this.phase) * tailLength * 0.05);
            
            ctx.strokeStyle = `rgba(255, 255, 255, ${this.opacity})`;
            ctx.lineWidth = this.size;
            ctx.lineCap = 'round';
            ctx.stroke();
            
            // Un punto ligeramente más brillante en la cabeza de la estela
            ctx.beginPath();
            ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
            ctx.fillStyle = `rgba(255, 255, 255, ${this.opacity + 0.15})`;
            ctx.fill();
        }
    }
    
    function initParticles() {
        particles = [];
        // Densidad de partículas basada en resolución de pantalla
        const particleCount = Math.floor((width * height) / 8000); 
        for (let i = 0; i < particleCount; i++) {
            particles.push(new WindParticle());
        }
    }
    
    function animateParticles() {
        // Limpiado total sin rastro opaco para que se vea nítido el canvas
        ctx.clearRect(0, 0, width, height);
        
        particles.forEach(p => {
            p.update();
            p.draw();
        });
        
        requestAnimationFrame(animateParticles);
    }
    
    // Iniciar el efecto de viento
    window.addEventListener('resize', resizeCanvas);
    // Timeout para asegurar que el canvas tome medidas correctas del layout
    setTimeout(() => {
        resizeCanvas();
        animateParticles();
    }, 50);

});
