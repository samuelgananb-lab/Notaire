/**
 * NOTAIRE SYSTEM - I18N, DYNAMIC GREETING & THEME CONTROLLER
 * 
 * 1. Soporte multilingüe completo (Español / English) con persistencia.
 * 2. Saludo dinámico sincronizado con la hora local (Buenos días / Buenas tardes / Buenas noches).
 * 3. Controlador interactivo para el botón de tema (Luna / Sol) con soporte de Modo Claro / Modo Oscuro.
 */

(function () {
    'use strict';

    // Diccionario completo de traducciones
    const translations = {
        es: {
            langCode: 'ES',
            nav: {
                inicio: 'Inicio',
                gastos: 'Gastos',
                ingresos: 'Ingresos',
                ahorros: 'Ahorros',
                saldo: 'Saldo',
                metas: 'Metas',
                calendario: 'Calendario',
                configuracion: 'Configuración',
                verPerfil: 'Ver perfil',
                admin: 'Administrador'
            },
            titles: {
                'view-inicio': 'PANEL PRINCIPAL',
                'view-gastos': 'MIS GASTOS',
                'view-ingresos': 'MIS INGRESOS',
                'view-ahorros': 'MIS AHORROS',
                'view-saldo': 'MI SALDO',
                'view-metas': 'GESTIÓN DE METAS',
                'view-recordatorios': 'CALENDARIO NOTARIAL',
                'view-configuracion': 'CONFIGURACIÓN'
            },
            header: {
                searchPlaceholder: 'Buscar movimientos...',
                themeDarkTitle: 'Cambiar a Modo Claro',
                themeLightTitle: 'Cambiar a Modo Oscuro',
                langTitle: 'Cambiar idioma / Switch language'
            },
            greetings: {
                morning: '¡Buenos días,',
                afternoon: '¡Buenas tardes,',
                night: '¡Buenas noches,'
            },
            hero: {
                badgeAdmin: 'Panel Notarial y Financiero • Admin',
                badgeClient: 'Panel Financiero Personal',
                subtitle: 'Aquí tienes un resumen de tu situación financiera de hoy. Todo está bajo control.',
                btnMovement: 'Registrar movimiento',
                btnCalendar: 'Ver calendario',
                balanceLabel: 'Patrimonio Neto',
                balanceTrend: '+9.7% este mes'
            },
            stats: {
                income: 'Ingresos del mes',
                expenses: 'Gastos del mes',
                savings: 'Ahorros acumulados',
                goals: 'Metas activas',
                goalsSub: '64% promedio'
            },
            homeSections: {
                recentActivity: 'Actividad reciente',
                viewExpenses: 'Ver gastos',
                goalsProgress: 'Progreso de metas',
                viewAll: 'Ver todas',
                upcomingReminders: 'Próximos recordatorios',
                viewCalendar: 'Ver calendario'
            },
            gastos: {
                title: 'MIS GASTOS',
                subtitle: 'Controla y analiza en qué estás utilizando tu dinero.',
                periodThisMonth: 'Este mes',
                periodLastMonth: 'Mes pasado',
                btnRegister: 'Registrar gasto',
                statSpent: 'GASTADO ESTE MES',
                statBudget: 'PRESUPUESTO',
                statAvailable: 'DISPONIBLE',
                spentVsPrev: '8.4% vs el mes pasado',
                usedBudget: '82.7% utilizado',
                remaining: 'restante',
                chartTitle: '¿En qué gastas más?',
                totalLabel: 'Gastos totales',
                topExpenses: 'Tus mayores gastos',
                recentMovements: 'Últimos movimientos'
            },
            ingresos: {
                title: 'MIS INGRESOS',
                subtitle: 'Visualiza tus fuentes de dinero y su evolución.',
                btnRegister: 'Registrar ingreso',
                statTotal: 'TOTAL INGRESOS',
                statAvg: 'PROMEDIO MENSUAL',
                statTop: 'MAYOR INGRESO',
                chartEvolution: 'Evolución de ingresos',
                chartSources: 'Fuentes de ingresos',
                recentIncome: 'Últimos ingresos'
            },
            ahorros: {
                title: 'MIS AHORROS',
                subtitle: 'Sigue el progreso de tus metas y alcanza tus sueños.',
                btnNewGoal: 'Nueva meta',
                statTotal: 'TOTAL AHORRADO',
                statActive: 'METAS ACTIVAS',
                statPct: 'PORCENTAJE TOTAL',
                recentContributions: 'Aportes recientes a metas',
                tipTitle: 'Tip de ahorro',
                tipText: '¡Vas por buen camino! Si ahorras $150.000 más al mes, alcanzarás tus metas 2 meses antes.'
            },
            saldo: {
                title: 'MI SALDO',
                subtitle: 'Conoce tu situación financiera total.',
                statNet: 'PATRIMONIO NETO',
                statAssets: 'ACTIVOS',
                statLiabilities: 'PASIVOS',
                statLiquidity: 'LIQUIDEZ',
                chartEvolution: 'Evolución de tu patrimonio',
                chartDist: 'Distribución',
                yourAccounts: 'Tus cuentas',
                financialSummary: 'Resumen financiero',
                incomeThisMonth: 'Ingresos este mes',
                expensesThisMonth: 'Gastos este mes',
                savingsThisMonth: 'Ahorros este mes',
                netBalance: 'Saldo neto'
            },
            metas: {
                title: 'GESTIÓN DE METAS',
                subtitle: 'Define tus objetivos financieros y alcanza tus sueños.',
                ctaTitle: 'Crear nueva meta de ahorro',
                ctaSub: 'Define tu objetivo, monto y fecha límite. Notaire te ayuda a llegar allá.',
                btnAdd: 'Agregar Meta',
                statTotal: 'TOTAL AHORRADO',
                statActive: 'METAS ACTIVAS',
                statAvg: 'PROGRESO PROMEDIO',
                activeGoalsTitle: 'Mis metas activas',
                emptyTitle: 'Aún no tienes metas',
                emptySub: 'Crea tu primera meta de ahorro y empieza a avanzar hacia tus objetivos financieros.',
                emptyBtn: 'Crear primera meta'
            },
            calendario: {
                title: 'CALENDARIO NOTARIAL',
                subtitle: 'Organiza tus fechas importantes y recibe recordatorios.',
                btnNewEvent: 'Nuevo evento',
                today: 'Hoy',
                month: 'Mes',
                week: 'Semana',
                day: 'Día',
                days: ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'],
                months: ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'],
                tagNotarial: 'Notarial',
                tagPayment: 'Pago / Financiero',
                tagReminder: 'Recordatorio',
                tagPersonal: 'Personal',
                tagBirthday: 'Cumpleaños',
                notifTitle: 'Notificaciones activas',
                notifSub: 'Recibirás recordatorios 24h y 1h antes de cada evento.',
                btnManageNotif: 'Gestionar notificaciones',
                upcomingEvents: 'Próximos eventos',
                monthSummary: 'Resumen del mes',
                tipTitle: 'Tip Notaire',
                tipSub: 'Activa las notificaciones para recibir recordatorios antes de cada evento.'
            },
            config: {
                title: 'CONFIGURACIÓN',
                subtitle: 'Personaliza tu experiencia Notaire.',
                profileTitle: 'Mi Perfil',
                profileSub: 'Información personal y cuenta',
                btnEditProfile: 'Editar perfil',
                lblName: 'Nombre',
                lblEmail: 'Correo',
                lblPhone: 'Teléfono',
                appearanceTitle: 'Apariencia',
                appearanceSub: 'Tema y colores del panel',
                lblColorTheme: 'Tema de color',
                lblDisplayMode: 'Modo de visualización',
                modeDark: 'Oscuro',
                modeLight: 'Claro',
                modeAuto: 'Auto',
                regionTitle: 'Idioma y Región',
                regionSub: 'Moneda, fecha y formato',
                lblLang: 'Idioma',
                lblCurrency: 'Moneda',
                btnSavePrefs: 'Guardar preferencias',
                notifTitle: 'Notificaciones',
                notifSub: 'Alertas y recordatorios',
                budgetTitle: 'Presupuesto Mensual',
                budgetSub: 'Límite de gastos por categoría',
                btnSaveBudget: 'Guardar presupuesto',
                securityTitle: 'Seguridad',
                securitySub: 'Contraseña y acceso',
                changePassword: 'Cambiar contraseña',
                twoFactor: 'Autenticación 2FA',
                logout: 'Cerrar sesión'
            },
            toasts: {
                langChanged: 'Idioma cambiado a Español 🇪🇸',
                themeDark: '🌙 Modo oscuro activado',
                themeLight: '☀️ Modo claro activado'
            }
        },

        en: {
            langCode: 'EN',
            nav: {
                inicio: 'Home',
                gastos: 'Expenses',
                ingresos: 'Income',
                ahorros: 'Savings',
                saldo: 'Balance',
                metas: 'Goals',
                calendario: 'Calendar',
                configuracion: 'Settings',
                verPerfil: 'View profile',
                admin: 'Administrator'
            },
            titles: {
                'view-inicio': 'MAIN DASHBOARD',
                'view-gastos': 'MY EXPENSES',
                'view-ingresos': 'MY INCOME',
                'view-ahorros': 'MY SAVINGS',
                'view-saldo': 'MY BALANCE',
                'view-metas': 'GOALS MANAGEMENT',
                'view-recordatorios': 'NOTARIAL CALENDAR',
                'view-configuracion': 'SETTINGS'
            },
            header: {
                searchPlaceholder: 'Search transactions...',
                themeDarkTitle: 'Switch to Light Mode',
                themeLightTitle: 'Switch to Dark Mode',
                langTitle: 'Switch language / Cambiar idioma'
            },
            greetings: {
                morning: 'Good morning,',
                afternoon: 'Good afternoon,',
                night: 'Good evening,'
            },
            hero: {
                badgeAdmin: 'Notarial & Financial Panel • Admin',
                badgeClient: 'Personal Financial Panel',
                subtitle: 'Here is a summary of your financial status today. Everything is under control.',
                btnMovement: 'Add transaction',
                btnCalendar: 'View calendar',
                balanceLabel: 'Net Worth',
                balanceTrend: '+9.7% this month'
            },
            stats: {
                income: 'Monthly income',
                expenses: 'Monthly expenses',
                savings: 'Total savings',
                goals: 'Active goals',
                goalsSub: '64% average'
            },
            homeSections: {
                recentActivity: 'Recent activity',
                viewExpenses: 'View expenses',
                goalsProgress: 'Goals progress',
                viewAll: 'View all',
                upcomingReminders: 'Upcoming reminders',
                viewCalendar: 'View calendar'
            },
            gastos: {
                title: 'MY EXPENSES',
                subtitle: 'Track and analyze where your money is going.',
                periodThisMonth: 'This month',
                periodLastMonth: 'Last month',
                btnRegister: 'Add expense',
                statSpent: 'SPENT THIS MONTH',
                statBudget: 'BUDGET',
                statAvailable: 'AVAILABLE',
                spentVsPrev: '8.4% vs last month',
                usedBudget: '82.7% used',
                remaining: 'remaining',
                chartTitle: 'Where do you spend most?',
                totalLabel: 'Total expenses',
                topExpenses: 'Your top expenses',
                recentMovements: 'Recent transactions'
            },
            ingresos: {
                title: 'MY INCOME',
                subtitle: 'Visualize your income sources and growth.',
                btnRegister: 'Add income',
                statTotal: 'TOTAL INCOME',
                statAvg: 'MONTHLY AVERAGE',
                statTop: 'HIGHEST INCOME',
                chartEvolution: 'Income evolution',
                chartSources: 'Income sources',
                recentIncome: 'Recent income'
            },
            ahorros: {
                title: 'MY SAVINGS',
                subtitle: 'Track your goals progress and achieve your dreams.',
                btnNewGoal: 'New goal',
                statTotal: 'TOTAL SAVED',
                statActive: 'ACTIVE GOALS',
                statPct: 'TOTAL PERCENTAGE',
                recentContributions: 'Recent goal contributions',
                tipTitle: 'Savings tip',
                tipText: "You're on the right track! If you save $150.000 more per month, you'll reach your goals 2 months earlier."
            },
            saldo: {
                title: 'MY BALANCE',
                subtitle: 'Understand your complete financial health.',
                statNet: 'NET WORTH',
                statAssets: 'ASSETS',
                statLiabilities: 'LIABILITIES',
                statLiquidity: 'LIQUIDITY',
                chartEvolution: 'Net worth evolution',
                chartDist: 'Distribution',
                yourAccounts: 'Your accounts',
                financialSummary: 'Financial summary',
                incomeThisMonth: 'Income this month',
                expensesThisMonth: 'Expenses this month',
                savingsThisMonth: 'Savings this month',
                netBalance: 'Net balance'
            },
            metas: {
                title: 'GOALS MANAGEMENT',
                subtitle: 'Set your financial targets and reach your dreams.',
                ctaTitle: 'Create new savings goal',
                ctaSub: 'Set your target, amount, and deadline. Notaire helps you get there.',
                btnAdd: 'Add Goal',
                statTotal: 'TOTAL SAVED',
                statActive: 'ACTIVE GOALS',
                statAvg: 'AVERAGE PROGRESS',
                activeGoalsTitle: 'My active goals',
                emptyTitle: "You don't have goals yet",
                emptySub: 'Create your first savings goal and start making progress toward your objectives.',
                emptyBtn: 'Create first goal'
            },
            calendario: {
                title: 'NOTARIAL CALENDAR',
                subtitle: 'Organize your important dates and receive reminders.',
                btnNewEvent: 'New event',
                today: 'Today',
                month: 'Month',
                week: 'Week',
                day: 'Day',
                days: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
                months: ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'],
                tagNotarial: 'Notarial',
                tagPayment: 'Payment / Financial',
                tagReminder: 'Reminder',
                tagPersonal: 'Personal',
                tagBirthday: 'Birthday',
                notifTitle: 'Active notifications',
                notifSub: 'You will receive reminders 24h and 1h before each event.',
                btnManageNotif: 'Manage notifications',
                upcomingEvents: 'Upcoming events',
                monthSummary: 'Monthly summary',
                tipTitle: 'Notaire Tip',
                tipSub: 'Enable notifications to receive timely alerts before each event.'
            },
            config: {
                title: 'SETTINGS',
                subtitle: 'Customize your Notaire experience.',
                profileTitle: 'My Profile',
                profileSub: 'Personal information and account',
                btnEditProfile: 'Edit profile',
                lblName: 'Name',
                lblEmail: 'Email',
                lblPhone: 'Phone',
                appearanceTitle: 'Appearance',
                appearanceSub: 'Theme and panel colors',
                lblColorTheme: 'Color theme',
                lblDisplayMode: 'Display mode',
                modeDark: 'Dark',
                modeLight: 'Light',
                modeAuto: 'Auto',
                regionTitle: 'Language & Region',
                regionSub: 'Currency, date and format',
                lblLang: 'Language',
                lblCurrency: 'Currency',
                btnSavePrefs: 'Save preferences',
                notifTitle: 'Notifications',
                notifSub: 'Alerts and reminders',
                budgetTitle: 'Monthly Budget',
                budgetSub: 'Category spending limit',
                btnSaveBudget: 'Save budget',
                securityTitle: 'Security',
                securitySub: 'Password and access',
                changePassword: 'Change password',
                twoFactor: '2FA Authentication',
                logout: 'Log out'
            },
            toasts: {
                langChanged: 'Language set to English 🇺🇸',
                themeDark: '🌙 Dark mode enabled',
                themeLight: '☀️ Light mode enabled'
            }
        }
    };

    // Helper de Idioma
    function getCurrentLang() {
        return localStorage.getItem('notaire_lang') || 'es';
    }

    // Helper de Saludo según hora del día
    function getTimeGreetingText(lang) {
        const hour = new Date().getHours();
        const t = translations[lang] || translations.es;
        if (hour >= 5 && hour < 12) {
            return t.greetings.morning;
        } else if (hour >= 12 && hour < 19) {
            return t.greetings.afternoon;
        } else {
            return t.greetings.night;
        }
    }

    // Actualizar el saludo del hero de forma dinámica
    function updateHeroGreeting() {
        const lang = getCurrentLang();
        const greetingPrefix = getTimeGreetingText(lang);
        const welcomeTitle = document.querySelector('.hero-welcome-title');
        
        let userName = 'Samuel';
        if (typeof NotaireState !== 'undefined' && NotaireState.user && NotaireState.user.nombre) {
            userName = NotaireState.user.nombre.split(' ')[0];
        } else {
            const el = document.getElementById('heroUserName');
            if (el && el.textContent.trim()) userName = el.textContent.trim();
        }

        if (welcomeTitle) {
            welcomeTitle.innerHTML = `${greetingPrefix} <span id="heroUserName">${userName}</span>! 👋`;
        }
    }

    // Aplicar traducción a toda la interfaz
    function applyLanguage(lang) {
        if (!translations[lang]) lang = 'es';
        localStorage.setItem('notaire_lang', lang);
        document.documentElement.setAttribute('lang', lang);

        const t = translations[lang];

        // 1. Botón de idioma en el header
        const langCodeSpan = document.getElementById('headerLangCode');
        if (langCodeSpan) {
            langCodeSpan.textContent = t.langCode;
        }
        const langBtn = document.getElementById('langToggleBtn');
        if (langBtn) {
            langBtn.setAttribute('title', t.header.langTitle);
        }

        // 2. Select de idioma en Configuración
        const cfgIdioma = document.getElementById('cfgIdioma');
        if (cfgIdioma) {
            cfgIdioma.value = lang === 'en' ? 'English (US)' : 'Español (Colombia)';
        }

        // 3. Menú de navegación lateral (Sidebar)
        const navMap = [
            { target: 'view-inicio', key: 'inicio' },
            { target: 'view-gastos', key: 'gastos' },
            { target: 'view-ingresos', key: 'ingresos' },
            { target: 'view-ahorros', key: 'ahorros' },
            { target: 'view-saldo', key: 'saldo' },
            { target: 'view-metas', key: 'metas' },
            { target: 'view-recordatorios', key: 'calendario' },
            { target: 'view-configuracion', key: 'configuracion' }
        ];

        navMap.forEach(item => {
            const a = document.querySelector(`#sidebarMenu a[data-target="${item.target}"]`);
            if (a) {
                const span = a.querySelector('span');
                if (span) span.textContent = t.nav[item.key];
            }
        });

        // 4. Perfil en sidebar
        const actionLink = document.querySelector('.profile-action-link');
        if (actionLink) {
            const isAdmin = actionLink.querySelector('.fa-shield-alt');
            if (isAdmin) {
                actionLink.innerHTML = `<i class="fas fa-shield-alt" style="color: #10b981;"></i> ${t.nav.admin}`;
            } else {
                actionLink.innerHTML = `<i class="fas fa-user-gear"></i> ${t.nav.verPerfil}`;
            }
        }

        // 5. Placeholder del buscador global
        const searchInput = document.getElementById('globalSearchInput');
        if (searchInput) {
            searchInput.setAttribute('placeholder', t.header.searchPlaceholder);
        }

        // 6. Título dinámico actual del top header
        const activeSection = document.querySelector('.content-section.active');
        const activeId = activeSection ? activeSection.id : 'view-inicio';
        const dynamicTitle = document.getElementById('headerDynamicTitle');
        if (dynamicTitle && t.titles[activeId]) {
            dynamicTitle.textContent = t.titles[activeId];
        }

        // 7. Saludo del Hero
        updateHeroGreeting();

        // 8. Badge y textos del Hero
        const greetingBadge = document.querySelector('.hero-greeting-badge');
        if (greetingBadge) {
            const isAdm = greetingBadge.querySelector('.fa-shield-halved');
            if (isAdm) {
                greetingBadge.innerHTML = `<i class="fas fa-shield-halved"></i> ${t.hero.badgeAdmin}`;
            } else {
                greetingBadge.innerHTML = `<i class="fas fa-star"></i> ${t.hero.badgeClient}`;
            }
        }
        const heroSubtitle = document.querySelector('.hero-welcome-subtitle');
        if (heroSubtitle) heroSubtitle.textContent = t.hero.subtitle;

        const btnHeroAction = document.querySelector('.btn-hero-action');
        if (btnHeroAction && btnHeroAction.closest('.hero-welcome-banner')) {
            btnHeroAction.innerHTML = `<i class="fas fa-plus"></i> ${t.hero.btnMovement}`;
        }
        const btnHeroSec = document.querySelector('.btn-hero-secondary');
        if (btnHeroSec) {
            btnHeroSec.innerHTML = `<i class="fas fa-calendar-alt"></i> ${t.hero.btnCalendar}`;
        }

        const heroBalLabel = document.querySelector('.hero-balance-label');
        if (heroBalLabel) heroBalLabel.textContent = t.hero.balanceLabel;
        const heroBalTrend = document.querySelector('.hero-balance-trend');
        if (heroBalTrend) heroBalTrend.innerHTML = `<i class="fas fa-arrow-trend-up"></i> ${t.hero.balanceTrend}`;

        // 9. Quick Stats Row en Inicio
        const statLabels = document.querySelectorAll('.home-stat-label');
        if (statLabels.length >= 4) {
            statLabels[0].textContent = t.stats.income;
            statLabels[1].textContent = t.stats.expenses;
            statLabels[2].textContent = t.stats.savings;
            statLabels[3].textContent = t.stats.goals;
        }

        // 10. Actualizar encabezados de días en el calendario si existe
        if (typeof CalendarState !== 'undefined' && typeof renderCalendar === 'function') {
            if (typeof MONTH_NAMES !== 'undefined') {
                for (let i = 0; i < 12; i++) {
                    MONTH_NAMES[i] = t.calendario.months[i];
                }
            }
            renderCalendar();
        }

        // 11. Tooltip del botón de tema
        updateThemeToggleIcon();
    }

    // Alternar idioma
    window.toggleLanguage = function () {
        const current = getCurrentLang();
        const next = current === 'es' ? 'en' : 'es';
        applyLanguage(next);
        if (typeof showToast === 'function') {
            showToast(translations[next].toasts.langChanged);
        }
    };

    // Cambiar idioma desde select
    window.setLanguageFromSelect = function (val) {
        const lang = (val && val.toLowerCase().includes('en')) ? 'en' : 'es';
        applyLanguage(lang);
        if (typeof showToast === 'function') {
            showToast(translations[lang].toasts.langChanged);
        }
    };

    /* ==========================================================================
       CONTROLADOR DEL BOTÓN DE TEMA (LUNA / SOL)
       ========================================================================== */
    function getCurrentTheme() {
        return localStorage.getItem('notaire_theme') || 'notaire';
    }

    function updateThemeToggleIcon() {
        const theme = getCurrentTheme();
        const isLight = (theme === 'light');
        const lang = getCurrentLang();
        const t = translations[lang] || translations.es;

        const btn = document.getElementById('themeToggleBtn');
        if (btn) {
            btn.innerHTML = isLight ? '<i class="fas fa-sun" style="color: #f59e0b;"></i>' : '<i class="fas fa-moon"></i>';
            btn.setAttribute('title', isLight ? t.header.themeLightTitle : t.header.themeDarkTitle);
        }

        // Sincronizar pills en Configuración si están presentes
        const optDark = document.getElementById('themeOptDark');
        const optLight = document.getElementById('themeOptLight');
        if (optDark && optLight) {
            optDark.classList.toggle('active', !isLight);
            optLight.classList.toggle('active', isLight);
        }
    }

    function applyTheme(theme) {
        document.documentElement.setAttribute('data-theme', theme);
        localStorage.setItem('notaire_theme', theme);
        updateThemeToggleIcon();
    }

    window.toggleTheme = function () {
        const current = getCurrentTheme();
        const next = current === 'light' ? 'notaire' : 'light';
        applyTheme(next);

        const lang = getCurrentLang();
        const t = translations[lang] || translations.es;
        if (typeof showToast === 'function') {
            showToast(next === 'light' ? t.toasts.themeLight : t.toasts.themeDark);
        }
    };

    // Función exportada para el panel de configuración
    window.setDisplayMode = function (mode, el) {
        document.querySelectorAll('.config-toggle-opt').forEach(o => o.classList.remove('active'));
        if (el) el.classList.add('active');

        if (mode === 'light') {
            applyTheme('light');
        } else if (mode === 'dark') {
            applyTheme('notaire');
        } else {
            // Auto: basado en preferencia del sistema
            const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
            applyTheme(prefersDark ? 'notaire' : 'light');
        }

        const lang = getCurrentLang();
        const t = translations[lang] || translations.es;
        if (typeof showToast === 'function') {
            showToast(mode === 'light' ? t.toasts.themeLight : t.toasts.themeDark);
        }
    };

    /* ==========================================================================
       INICIALIZACIÓN AL CARGAR LA PÁGINA
       ========================================================================== */
    document.addEventListener('DOMContentLoaded', () => {
        // 1. Inicializar tema
        applyTheme(getCurrentTheme());

        // 2. Escuchar clic en botón de tema
        const themeBtn = document.getElementById('themeToggleBtn');
        if (themeBtn) {
            themeBtn.addEventListener('click', (e) => {
                e.preventDefault();
                window.toggleTheme();
            });
        }

        // 3. Escuchar clic en botón de idioma si existe
        const langBtn = document.getElementById('langToggleBtn');
        if (langBtn) {
            langBtn.addEventListener('click', (e) => {
                e.preventDefault();
                window.toggleLanguage();
            });
        }

        // 4. Escuchar cambios en selector de idioma de Configuración
        const cfgIdioma = document.getElementById('cfgIdioma');
        if (cfgIdioma) {
            cfgIdioma.addEventListener('change', (e) => {
                window.setLanguageFromSelect(e.target.value);
            });
        }

        // 5. Aplicar idioma guardado y saludo sincronizado con el reloj
        applyLanguage(getCurrentLang());
        updateHeroGreeting();

        // 6. Actualizar saludo automáticamente cada minuto
        setInterval(updateHeroGreeting, 60000);
    });

    // Exponer globalmente
    window.updateHeroGreeting = updateHeroGreeting;
    window.applyLanguage = applyLanguage;
    window.getCurrentLang = getCurrentLang;
    window.translations = translations;

})();
