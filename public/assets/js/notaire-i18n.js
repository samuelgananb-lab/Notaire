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
                metasAhorros: 'Ahorros',
                saldo: 'Saldo',
                calendario: 'Calendario',
                calculadora: 'Calculadora',
                soporte: 'Soporte',
                panel: 'Panel',
                finanzas: 'Finanzas',
                planificacion: 'Planificación',
                cuenta: 'Cuenta',
                configuracion: 'Configuración',
                verPerfil: 'Ver perfil',
                admin: 'Administrador'
            },
            titles: {
                'view-inicio': 'PANEL PRINCIPAL',
                'view-gastos': 'MIS GASTOS',
                'view-ingresos': 'MIS INGRESOS',
                'view-saldo': 'MI SALDO',
                'view-metas': 'AHORROS',
                'view-calculadora': 'CALCULADORA',
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
                balanceLabel: 'Liquidez',
                balanceTrend: 'Disponible después de gastos'
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
                title: 'AHORROS',
                pageSubtitle: 'Organiza tus objetivos, aportes y presupuesto en un solo lugar.',
                subtitle: 'Sigue el progreso de tus metas y alcanza tus sueños.',
                btnNewGoal: 'Nueva meta',
                statTotal: 'TOTAL AHORRADO',
                statActive: 'METAS ACTIVAS',
                statPct: 'PORCENTAJE TOTAL',
                recentContributions: 'Ahorros recientes',
                tipTitle: 'Tip Notaire',
                tipText: 'No trabajes solo por dinero; construye algo que genere valor incluso cuando tú no estés trabajando.'
            },
            saldo: {
                title: 'MI SALDO',
                subtitle: 'Conoce tu situación financiera total.',
                statNet: 'LIQUIDEZ',
                statAssets: 'ACTIVOS',
                statLiabilities: 'PASIVOS',
                statLiquidity: 'LIQUIDEZ',
                chartEvolution: 'Evolución de tu liquidez',
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
                metasAhorros: 'Savings',
                saldo: 'Balance',
                calendario: 'Calendar',
                calculadora: 'Calculator',
                soporte: 'Support',
                panel: 'Overview',
                finanzas: 'Finances',
                planificacion: 'Planning',
                cuenta: 'Account',
                configuracion: 'Settings',
                verPerfil: 'View profile',
                admin: 'Administrator'
            },
            titles: {
                'view-inicio': 'MAIN DASHBOARD',
                'view-gastos': 'MY EXPENSES',
                'view-ingresos': 'MY INCOME',
                'view-saldo': 'MY BALANCE',
                'view-metas': 'SAVINGS',
                'view-calculadora': 'CALCULATOR',
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
                balanceLabel: 'Liquidity',
                balanceTrend: 'Available after expenses'
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
                title: 'SAVINGS',
                pageSubtitle: 'Organize your goals, contributions, and budget in one place.',
                subtitle: 'Track your goals progress and achieve your dreams.',
                btnNewGoal: 'New goal',
                statTotal: 'TOTAL SAVED',
                statActive: 'ACTIVE GOALS',
                statPct: 'TOTAL PERCENTAGE',
                recentContributions: 'Recent savings',
                tipTitle: 'Notaire Tip',
                tipText: 'Do not work only for money; build something that creates value even when you are not working.'
            },
            saldo: {
                title: 'MY BALANCE',
                subtitle: 'Understand your complete financial health.',
                statNet: 'LIQUIDITY',
                statAssets: 'ASSETS',
                statLiabilities: 'LIABILITIES',
                statLiquidity: 'LIQUIDITY',
                chartEvolution: 'Liquidity evolution',
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

    const staticTextEnglish = {
        'Panel del Cliente': 'Client Dashboard',
        'Notaire - Panel del Cliente': 'Notaire - Client Dashboard',
        'Inicio': 'Home',
        'Gastos': 'Expenses',
        'Ingresos': 'Income',
        'GASTOS': 'EXPENSES',
        'INGRESOS': 'INCOME',
        'Patrimonio': 'Net worth',
        'Ahorros': 'Savings',
        'Metas': 'Goals',
        'Saldo': 'Balance',
        'Calendario': 'Calendar',
        'Soporte': 'Support',
        'Configuración': 'Settings',
        'Ver perfil': 'View profile',
        'PANEL PRINCIPAL': 'MAIN DASHBOARD',
        'Panel Financiero Personal': 'Personal Finance Dashboard',
        '¡Buenas noches,': 'Good evening,',
        '¡Buenos días,': 'Good morning,',
        '¡Buenas tardes,': 'Good afternoon,',
        'Aquí tienes un resumen de tu situación financiera de hoy. Todo está bajo control.': 'Here is a summary of your finances today. Everything is under control.',
        'Registrar movimiento': 'Add transaction',
        'Ver calendario': 'View calendar',
        'Liquidez': 'Liquidity',
        'Periodo de estadísticas': 'Statistics period',
        'Mensual': 'Monthly',
        'Semanal': 'Weekly',
        'Últimos 6 meses': 'Last 6 months',
        'Últimos 7 días': 'Last 7 days',
        'Cargando estadística semanal...': 'Loading weekly statistics...',
        'No se pudo cargar la estadística semanal. Intenta de nuevo.': 'Could not load weekly statistics. Try again.',
        'Mi saldo': 'My balance',
        'Análisis financiero': 'Financial overview',
        'Un resumen claro de tu liquidez, tus movimientos y tus ahorros.': 'A clear overview of your liquidity, transactions, and savings.',
        'Evolución de tu liquidez': 'Liquidity over time',
        'Ingresos menos gastos a lo largo del tiempo': 'Income minus expenses over time',
        'Balance neto': 'Net balance',
        'Así se compone tu liquidez': 'How your liquidity is distributed',
        'Indicadores principales de tu actividad': 'Key indicators of your activity',
        'Entradas registradas': 'Recorded income',
        'Salidas registradas': 'Recorded expenses',
        'Ahorro acumulado': 'Accumulated savings',
        'Disponible actualmente': 'Currently available',
        'Movimiento total': 'Total transactions',
        'Ingresos y gastos': 'Income and expenses',
        'Sin datos registrados': 'No data recorded',
        'Ingresos del mes': 'Monthly income',
        'Gastos del mes': 'Monthly expenses',
        'Ahorros acumulados': 'Total savings',
        'Metas activas': 'Active goals',
        'terminadas': 'completed',
        'Más cerca de cumplir': 'Closest to completion',
        'Tus tres metas activas con mayor avance.': 'Your three most advanced active goals.',
        'Mis metas': 'My goals',
        'Consulta tus objetivos en progreso y los que ya completaste.': 'Review goals in progress and the ones you have completed.',
        'Terminada': 'Completed',
        'En progreso': 'In progress',
        'por completar': 'remaining',
        'Sin fecha': 'No date',
        'Tus metas activas aparecerán aquí.': 'Your active goals will appear here.',
        'Actividad reciente': 'Recent activity',
        'Ver gastos': 'View expenses',
        'Progreso de metas': 'Goal progress',
        'Ver todas': 'View all',
        'Próximos recordatorios': 'Upcoming reminders',
        'MIS GASTOS': 'MY EXPENSES',
        'Controla y analiza en qué estás utilizando tu dinero.': 'Track and analyze where you spend your money.',
        'Este mes': 'This month',
        'Mes pasado': 'Last month',
        'GASTADO ESTE MES': 'SPENT THIS MONTH',
        'PRESUPUESTO': 'BUDGET',
        'DISPONIBLE': 'AVAILABLE',
        'después de gastos': 'after expenses',
        '¿En qué gastas más?': 'Where do you spend the most?',
        'Gastos totales': 'Total expenses',
        'Tus mayores gastos': 'Your top expenses',
        'Últimos movimientos': 'Recent transactions',
        'Ver todos': 'View all',
        'MIS INGRESOS': 'MY INCOME',
        'Visualiza tus fuentes de dinero y su evolución.': 'Review your income sources and how they change over time.',
        'TOTAL INGRESOS': 'TOTAL INCOME',
        'PROMEDIO MENSUAL': 'MONTHLY AVERAGE',
        'Periodo actual': 'Current period',
        'MAYOR INGRESO': 'HIGHEST INCOME',
        'Mayor registro': 'Largest transaction',
        'Evolución de ingresos': 'Income over time',
        'Fuentes de ingresos': 'Income sources',
        'Total': 'Total',
        'Últimos ingresos': 'Recent income',
        'MI SALDO': 'MY BALANCE',
        'Evolución de tu liquidez (ingresos − gastos)': 'Liquidity over time (income − expenses)',
        'Distribución': 'Distribution',
        'Disponible': 'Available',
        'Liquidez actual': 'Current liquidity',
        'Resumen financiero': 'Financial summary',
        'Ingresos totales': 'Total income',
        'Ahorros / Metas': 'Savings / Goals',
        'Liquidez disponible': 'Available liquidity',
        'Movimiento total (ingresos + gastos)': 'Total transactions (income + expenses)',
        'AHORROS': 'SAVINGS',
        'Organiza tus objetivos, aportes y presupuesto en un solo lugar.': 'Organize your goals, contributions, and budget in one place.',
        'Crear nueva meta de ahorro': 'Create a savings goal',
        'Define tu objetivo, monto y fecha límite. Notaire te ayuda a llegar allá.': 'Set your goal, amount, and deadline. Notaire will help you get there.',
        'Agregar Meta': 'Add goal',
        'TOTAL AHORRADO': 'TOTAL SAVED',
        'en progreso': 'in progress',
        'PROGRESO PROMEDIO': 'AVERAGE PROGRESS',
        'Mis metas activas': 'My active goals',
        'Aún no tienes metas': "You don't have any goals yet",
        'Crea tu primera meta de ahorro y empieza a avanzar hacia tus objetivos financieros.': 'Create your first savings goal and start working toward your financial objectives.',
        'Crear primera meta': 'Create your first goal',
        'Ahorros recientes': 'Recent savings',
        'Tip de ahorro': 'Savings tip',
        'Programa una transferencia automática del 10% de tus ingresos el día que recibes tu pago; ahorras antes de gastar.': 'Schedule an automatic transfer of 10% of your income on payday so you save before you spend.',
        'Presupuesto Mensual': 'Monthly budget',
        'Límite de gastos por categoría': 'Spending limit by category',
        'Presupuesto total mensual ($)': 'Total monthly budget ($)',
        'Alimentación': 'Food',
        'Transporte': 'Transportation',
        'Ahorros': 'Savings',
        'Entretenimiento': 'Entertainment',
        'Servicios': 'Utilities',
        'Guardar presupuesto': 'Save budget',
        'CALENDARIO NOTARIAL': 'NOTARIAL CALENDAR',
        'Organiza tus fechas importantes y recibe recordatorios.': 'Organize important dates and get reminders.',
        'Calendario de Pagos y Compromisos': 'Payments and commitments calendar',
        'Controla tus vencimientos y marca los pagos realizados.': 'Track your due dates and mark payments as completed.',
        'Cargando pagos y compromisos...': 'Loading payments and commitments...',
        'Marcar como pendiente': 'Mark as pending',
        'Marcar como pagado': 'Mark as paid',
        'Eliminar compromiso': 'Delete commitment',
        '+ Nuevo Recordatorio': '+ New reminder',
        'Hoy': 'Today',
        'Notarial': 'Notarial',
        'Pago / Financiero': 'Payment / Financial',
        'Recordatorio': 'Reminder',
        'Financiero': 'Financial',
        'Sin eventos próximos': 'No upcoming events',
        'Mes': 'Month',
        'Semana': 'Week',
        'Día': 'Day',
        'Editar': 'Edit',
        'Eliminar': 'Delete',
        'Registrar gasto': 'Add expense',
        'Registrar ingreso': 'Add income',
        'Total:': 'Total:',
        'Monto': 'Amount',
        'Acciones': 'Actions',
        'METAS ACTIVAS': 'ACTIVE GOALS',
        'Nuevo evento': 'New event',
        'Gestionar notificaciones': 'Manage notifications',
        'Sin teléfono': 'No phone number',
        'Fecha límite': 'Deadline',
        'Tipo:': 'Type:',
        'Mar': 'Tue',
        '🧾 Alimentación': '🧾 Food',
        '🍔 Alimentación': '🍔 Food',
        '🚌 Transporte': '🚌 Transportation',
        '🎮 Entretenimiento': '🎮 Entertainment',
        '🏠 Servicios': '🏠 Utilities',
        '🛒 Otros': '🛒 Other',
        '💼 Salario': '💼 Salary',
        '💻 Freelance': '💻 Freelance',
        '🛍️ Negocio': '🛍️ Business',
        '💰 Intereses': '💰 Interest',
        '🟢 Otros': '🟢 Other',
        '🟣 Notarial': '🟣 Notarial',
        '🟢 Pago / Financiero': '🟢 Payment / Financial',
        '🟠 Recordatorio': '🟠 Reminder',
        '🔵 Personal': '🔵 Personal',
        '🩷 Cumpleaños': '🩷 Birthday',
        'Morado original': 'Original purple',
        'Verde azulado': 'Teal',
        'Naranja': 'Orange',
        'Cian': 'Cyan',
        'Índigo': 'Indigo',
        'Rojo': 'Red',
        'Aplicar tema verde azulado': 'Apply teal theme',
        'Aplicar tema naranja': 'Apply orange theme',
        'Aplicar tema cian': 'Apply cyan theme',
        'Aplicar tema índigo': 'Apply indigo theme',
        'Aplicar tema rojo': 'Apply red theme',
        'Control financiero': 'Financial management',
        'Registra tus ingresos y gastos en un solo lugar.': 'Track your income and expenses in one place.',
        'Tipo de movimiento': 'Transaction type',
        'opcional': 'optional',
        'Agrega un detalle para identificarlo': 'Add a detail to identify it',
        'Guardar movimiento': 'Save transaction',
        'Azul': 'Blue',
        'Verde': 'Green',
        'Rosa': 'Pink',
        'Gris': 'Gray',
        'Meta general': 'General goal',
        'Viajes': 'Travel',
        'Vacaciones': 'Vacation',
        'Vivienda': 'Housing',
        'Vehículo': 'Vehicle',
        'Tecnología': 'Technology',
        'Protección financiera': 'Financial protection',
        'Estudios': 'Education',
        'Celebración': 'Celebration',
        'Salud y deporte': 'Health and fitness',
        'Salario': 'Salary',
        'Freelance': 'Freelance',
        'Negocio': 'Business',
        'Intereses': 'Interest',
        'Personal': 'Personal',
        'Cumpleaños': 'Birthday',
        'Sin comparación': 'No comparison',
        '0 metas': '0 goals',
        '0 metas (0% promedio)': '0 goals (0% average)',
        '0% promedio': '0% average',
        '0% utilizado': '0% used',
        'Listado de Gastos': 'Expense list',
        'Listado de Ingresos': 'Income list',
        'No hay movimientos recientes.': 'No recent transactions.',
        'No hay metas registradas.': 'No goals recorded.',
        'No se encontraron resultados con los filtros aplicados.': 'No results match the selected filters.',
        'No tienes compromisos financieros programados.': 'No financial commitments are scheduled.',
        'No se pudieron cargar los movimientos. Revisa tu sesión o intenta de nuevo.': 'Could not load transactions. Check your session or try again.',
        'No se pudieron cargar los gastos.': 'Could not load expenses.',
        'No se pudieron cargar los ingresos.': 'Could not load income.',
        'No se pudieron cargar las solicitudes.': 'Could not load requests.',
        'No se pudieron cargar las categorías.': 'Could not load categories.',
        'No se pudieron cargar los movimientos': 'Could not load transactions',
        'No hay eventos próximos.': 'No upcoming events.',
        'No hay eventos este mes.': 'No events this month.',
        'No hay registros este mes.': 'No records this month.',
        'No hay gastos registrados este mes.': 'No expenses recorded this month.',
        'Sin registros este mes.': 'No records this month.',
        'Aún no has enviado solicitudes.': "You haven't submitted any requests yet.",
        'Editar meta': 'Edit goal',
        'Eliminar meta': 'Delete goal',
        'Desactivar notificaciones': 'Turn off notifications',
        'Activar notificaciones': 'Turn on notifications',
        'Guardando...': 'Saving...',
        'N/A': 'N/A',
        'General': 'General',
        'Sin presupuesto': 'No budget set',
        'Sin registros': 'No records',
        'Error al cargar eventos': 'Could not load events',
        'Error al procesar la transacción': 'Could not process the transaction',
        'Error al eliminar transacción': 'Could not delete the transaction',
        'Error al obtener recordatorios': 'Could not load reminders',
        'Error al guardar recordatorio': 'Could not save the reminder',
        'Error al actualizar estado': 'Could not update the status',
        'Error al eliminar recordatorio': 'Could not delete the reminder',
        'Fecha de vencimiento': 'Due date',
        'Vence:': 'Due:',
        'Pagado': 'Paid',
        'Pendiente': 'Pending',
        'Prioridad': 'Priority',
        'Abierta': 'Open',
        'En proceso': 'In progress',
        'Resuelta': 'Resolved',
        'Rechazada': 'Rejected',
        '24h antes': '24 hours before',
        '1h antes': '1 hour before',
        'El mismo día': 'The same day',
        'Reporta un error o envía una solicitud. Un administrador o empleado te responderá aquí.': 'Report an issue or send a request. An administrator or employee will respond here.',
        'Recibirás alertas y recordatorios en este navegador.': 'You will receive alerts and reminders in this browser.',
        'Idioma y Región': 'Language and region',
        'El idioma se gestiona desde el botón arriba a la derecha.': 'Change the language using the button in the upper-right corner.',
        'Continuar': 'Continue',
        'No hay datos suficientes para mostrar esta gráfica.': 'There is not enough data to display this chart.',
        'LIQUIDEZ DISPONIBLE': 'AVAILABLE LIQUIDITY',
        'Listado de movimientos': 'Transaction list',
        'Editar Movimiento': 'Edit transaction',
        'Cargando aportes...': 'Loading contributions...',
        'Cargando gastos...': 'Loading expenses...',
        'Completa un nombre y un monto objetivo válido': 'Enter a name and a valid target amount',
        'No se pudo registrar el aporte': 'Could not record the contribution',
        'No se pudo actualizar la meta': 'Could not update the goal',
        'No se pudo eliminar la meta': 'Could not delete the goal',
        'Dom': 'Sun',
        'Lun': 'Mon',
        'Mié': 'Wed',
        'Jue': 'Thu',
        'Vie': 'Fri',
        'Sáb': 'Sat',
        'Notificaciones activas': 'Notifications enabled',
        'Recibirás recordatorios 24h y 1h antes de cada evento.': 'You will receive reminders 24 hours and 1 hour before each event.',
        'Próximos eventos': 'Upcoming events',
        'Resumen del mes': 'Monthly summary',
        'Tip Notaire': 'Notaire tip',
        'Ir a la configuración de notificaciones': 'Go to notification settings',
        'Notaire Tip': 'Notaire Tip',
        'Activa las notificaciones para recibir recordatorios antes de cada evento.': 'Enable notifications to get reminders before each event.',
        'SOPORTE Y SOLICITUDES': 'SUPPORT AND REQUESTS',
        'Centro de ayuda Notaire': 'NOTAIRE HELP CENTER',
        'Cuéntanos qué necesitas': 'Tell us what you need',
        'Elige el tipo y la prioridad para orientar mejor tu solicitud.': 'Choose a type and priority to help route your request.',
        'Resume tu solicitud en una frase': 'Summarize your request in one sentence',
        'Incluye los detalles necesarios para poder ayudarte.': 'Include the details needed to help you.',
        'El equipo de Notaire te responderá en esta sección.': 'The Notaire team will reply in this section.',
        'Seguimiento y respuestas del equipo': 'Track your requests and team replies',
        'Aún no has enviado solicitudes.': 'You have not sent any requests yet.',
        'Cuando envíes una, podrás seguir su estado y respuesta aquí.': 'Once you send one, you can track its status and reply here.',
        'Colores de marca': 'Brand colors',
        'Acentos y neutros': 'Accents and neutrals',
        'Notaire': 'Notaire',
        'Aplicar tema Notaire': 'Apply Notaire theme',
        'Azul': 'Blue',
        'Aplicar tema azul': 'Apply blue theme',
        'Índigo': 'Indigo',
        'Aplicar tema índigo': 'Apply indigo theme',
        'Cian': 'Cyan',
        'Aplicar tema cian': 'Apply cyan theme',
        'Turquesa': 'Teal',
        'Aplicar tema turquesa': 'Apply teal theme',
        'Esmeralda': 'Emerald',
        'Aplicar tema esmeralda': 'Apply emerald theme',
        'Dorado': 'Gold',
        'Aplicar tema dorado': 'Apply gold theme',
        'Naranja': 'Orange',
        'Aplicar tema naranja': 'Apply orange theme',
        'Rojo': 'Red',
        'Aplicar tema rojo': 'Apply red theme',
        'Rosa': 'Rose',
        'Aplicar tema rosa': 'Apply rose theme',
        'Gris': 'Gray',
        'Aplicar tema gris': 'Apply gray theme',
        'Carbón': 'Charcoal',
        'Aplicar tema carbón': 'Apply charcoal theme',
        'Reporte de error': 'Bug report',
        'Soporte / ayuda': 'Support / help',
        'Solicitud (cambio, permiso o trámite)': 'Request (change, permission, or procedure)',
        'Otro': 'Other',
        'Baja': 'Low',
        'Media': 'Medium',
        'Alta': 'High',
        'Asunto': 'Subject',
        'Descripción': 'Description',
        'Enviar': 'Send',
        'Mis solicitudes': 'My requests',
        'Cargando...': 'Loading...',
        'CONFIGURACIÓN': 'SETTINGS',
        'Personaliza tu experiencia Notaire.': 'Customize your Notaire experience.',
        'Mi Perfil': 'My profile',
        'Información personal y cuenta': 'Personal and account information',
        'Editar perfil': 'Edit profile',
        'Nombre': 'Name',
        'Correo': 'Email',
        'Teléfono': 'Phone',
        'Apariencia': 'Appearance',
        'Tema y colores del panel': 'Dashboard theme and colors',
        'Tema de color': 'Color theme',
        'Modo de visualización': 'Display mode',
        'Oscuro': 'Dark',
        'Claro': 'Light',
        'Auto': 'Auto',
        'Notificaciones': 'Notifications',
        'Alertas y recordatorios': 'Alerts and reminders',
        'Notificaciones del navegador': 'Browser notifications',
        'Recibir alertas en el navegador': 'Receive browser alerts',
        'Recordatorio 24h antes': 'Reminder 24 hours before',
        'Un día antes del evento': 'One day before the event',
        'Recordatorio 1h antes': 'Reminder 1 hour before',
        'Una hora antes del evento': 'One hour before the event',
        'Alertas de gastos': 'Expense alerts',
        'Cuando superes el presupuesto': 'When you exceed your budget',
        'Resumen semanal': 'Weekly summary',
        'Reporte cada lunes': 'Report every Monday',
        'Seguridad': 'Security',
        'Contraseña y acceso': 'Password and access',
        'Cambiar contraseña': 'Change password',
        'Autenticación 2FA': 'Two-factor authentication',
        'Cerrar sesión': 'Log out',
        'Movimientos': 'Transactions',
        'Más': 'More',
        'Registrar Nuevo Gasto': 'Record a new expense',
        'Monto ($)': 'Amount ($)',
        'Categoría': 'Category',
        'Guardar Gasto': 'Save expense',
        'Registrar Nuevo Ingreso': 'Record new income',
        'Fuente': 'Source',
        'Guardar Ingreso': 'Save income',
        'Crear Nueva Meta': 'Create a new goal',
        'Ícono de la meta': 'Goal icon',
        'Nombre de la meta': 'Goal name',
        'Monto Objetivo ($)': 'Target amount ($)',
        'Monto Inicial (ahorro actual)': 'Initial amount (current savings)',
        'Fecha Límite': 'Deadline',
        'Crear Meta': 'Create goal',
        'Aportar a Meta': 'Contribute to goal',
        'Meta': 'Goal',
        'Monto a Aportar ($)': 'Contribution amount ($)',
        'Confirmar Aporte': 'Confirm contribution',
        'Perfil de Usuario': 'User profile',
        'Nombre completo': 'Full name',
        'Correo electrónico': 'Email address',
        'Documento': 'Document',
        'Guardar Cambios': 'Save changes',
        'Historial': 'History',
        'Editar Gasto': 'Edit expense',
        'Editar Ingreso': 'Edit income',
        'Editar Meta': 'Edit goal',
        'Monto objetivo ($)': 'Target amount ($)',
        'Monto actual ($)': 'Current amount ($)',
        'Nuevo Evento': 'New event',
        'Título del evento': 'Event title',
        'Tipo': 'Type',
        'Fecha': 'Date',
        'Hora': 'Time',
        'Nota / Descripción': 'Note / Description',
        'Guardar Evento': 'Save event',
        'Detalle del evento': 'Event details',
        'Aceptar': 'OK',
        'Operación realizada con éxito': 'Operation completed successfully',
        'Registrar Movimiento': 'Record transaction',
        'Ingreso': 'Income',
        'Gasto': 'Expense',
        'Monto ($):': 'Amount ($):',
        'Categoría:': 'Category:',
        'Descripción:': 'Description:',
        'Cancelar': 'Cancel',
        'Guardar': 'Save',
        'Abonar a Meta': 'Contribute to goal',
        'Monto a Abonar ($):': 'Contribution amount ($):',
        'Guardar Abono': 'Save contribution',
        'Nuevo Compromiso Financiero': 'New financial commitment',
        'Concepto / Título:': 'Concept / Title:',
        'Fecha de Vencimiento:': 'Due date:',
        'Guardar Recordatorio': 'Save reminder',
        'Ej: Viaje a Cartagena': 'E.g. trip to Cartagena',
        'Ej: 5000000': 'E.g. 5,000,000',
        'Ej: 50000': 'E.g. 50,000',
        'Ej: 1800000': 'E.g. 1,800,000',
        'Ej: 200000': 'E.g. 200,000',
        'Ej: Almuerzo con compañeros': 'E.g. lunch with coworkers',
        'Ej: Salario agosto': 'E.g. August salary',
        'Ej: Pago de hipoteca': 'E.g. mortgage payment',
        'Nombre del usuario': 'User name',
        'Correo del usuario': 'User email',
        'Fondo de emergencia': 'Emergency fund',
        'Sin correo': 'No email',
        'Aportar': 'Contribute',
        'Falta:': 'Remaining:',
        'Fecha:': 'Date:',
        'Sin fecha': 'No date',
        'No se pudieron cargar las metas.': 'Could not load goals.',
        'No se pudieron cargar los aportes.': 'Could not load contributions.',
        'Meta eliminada correctamente': 'Goal deleted successfully',
        'Meta actualizada correctamente': 'Goal updated successfully',
        'Perfil actualizado correctamente': 'Profile updated successfully',
        'Completa los datos de la meta correctamente': 'Enter valid goal details',
        'Nombre y correo son obligatorios': 'Name and email are required',
        'No se pudo actualizar el perfil': 'Could not update the profile',
        'Error al sincronizar el estado de usuario:': 'Could not sync user state:',
        'Error al actualizar la vista de Ahorros:': 'Could not update the savings view:',
        'Error sincronizando ahorro y metas:': 'Could not sync savings and goals:',
        'Aporte registrado con éxito': 'Contribution recorded successfully',
        '¡Aporte registrado con éxito!': 'Contribution recorded successfully!',
        '¡Meta de ahorro creada con éxito!': 'Savings goal created successfully!',
        'Meta creada correctamente': 'Goal created successfully',
        'Movimiento guardado correctamente': 'Transaction saved successfully',
        'Calculadora': 'Calculator',
        'CALCULADORA': 'CALCULATOR',
        'Resuelve operaciones cotidianas y científicas con precisión.': 'Solve everyday and scientific calculations with precision.',
        'No trabajes solo por dinero; construye algo que genere valor incluso cuando tú no estés trabajando.': 'Do not work only for money; build something that creates value even when you are not working.',
        'Agregar categoría': 'Add category',
        'Elige la prioridad, pulsa el emoji para cambiarlo y usa Editar para modificar el nombre o monto.': 'Choose the priority, click the emoji to change it, and use Edit to change the name or amount.',
        'Eliminar categoría': 'Delete category',
        'Servicios': 'Services',
        'Alimentación': 'Food',
        'Transporte': 'Transport',
        'Ahorros': 'Savings',
        'Entretenimiento': 'Entertainment',
        'Nombre de categoría': 'Category name',
        'Presupuesto de categoría': 'Category budget',
        'Prioridad de categoría': 'Category priority',
        'Elegir emoji': 'Choose emoji',
        'Editar categoría': 'Edit category',
        'Terminar edición de categoría': 'Finish editing category',
        'Cambiar signo del número': 'Change number sign',
        'Cambia el signo del número entre positivo y negativo': 'Switch the number between positive and negative',
        'Todo al día': 'All caught up',
        'Tus avisos aparecerán aquí': 'Your alerts will appear here',
        'Marcar leídas': 'Mark as read',
        'Sin notificaciones por ahora': 'No notifications yet',
        'Los recordatorios y avisos financieros aparecerán aquí.': 'Reminders and financial alerts will appear here.',
        'Resumen diario': 'Daily summary',
        'Aviso diario de compromisos pendientes': 'Daily alert for upcoming commitments',
        'Resumen mensual': 'Monthly summary',
        'Aviso para revisar tu presupuesto al iniciar el mes': 'Reminder to review your budget at the start of the month',
        'Modo angular': 'Angle mode'
    };
    const staticTextSpanish = Object.fromEntries(
        Object.entries(staticTextEnglish).map(([spanish, english]) => [english, spanish])
    );

    // Helper de Idioma
    function getCurrentLang() {
        return localStorage.getItem('notaire_lang') || 'es';
    }

    function translateStaticContent(lang) {
        const dictionary = lang === 'en' ? staticTextEnglish : staticTextSpanish;
        const excludedSelector = [
            'input',
            'textarea',
            'script',
            'style',
            '[contenteditable="true"]',
            '[data-user-content="true"]',
            '.transaction-title',
            '.goal-title-text',
            '.home-goal-name',
            '[data-user-content="true"]',
            '#sidebarUserName',
            '#nombre-usuario-saludo',
            '#heroUserName',
            '#detalleEventoTitulo',
            '#configNombre',
            '#configEmail',
            '.calendar-event',
            '.event-card',
            '#detalleEventoTitulo'
        ].join(',');
        const walker = document.createTreeWalker(document.body, 4);
        let textNode;

        while ((textNode = walker.nextNode())) {
            if (textNode.parentElement?.closest(excludedSelector)) continue;
            const original = textNode.data.trim();
            const translated = dictionary[original];
            if (translated) {
                textNode.data = textNode.data.replace(original, translated);
            }
        }

        const attributeExcludedSelector = [
            '.transaction-title',
            '.goal-title-text',
            '.home-goal-name',
            '#sidebarUserName',
            '#nombre-usuario-saludo',
            '#heroUserName',
            '.calendar-event',
            '.event-card'
        ].join(',');
        document.querySelectorAll('[placeholder], [title], [aria-label]').forEach(element => {
            if (element.closest(attributeExcludedSelector)) return;
            ['placeholder', 'title', 'aria-label'].forEach(attribute => {
                const original = element.getAttribute(attribute);
                const translated = original && dictionary[original.trim()];
                if (translated) element.setAttribute(attribute, translated);
            });
        });
    }

    function translateText(text, lang = getCurrentLang()) {
        const dictionary = lang === 'en' ? staticTextEnglish : staticTextSpanish;
        return dictionary[String(text)] || text;
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
            { target: 'view-saldo', key: 'saldo' },
            { target: 'view-ingresos', key: 'ingresos' },
            { target: 'view-gastos', key: 'gastos' },
            { target: 'view-metas', key: 'metasAhorros' },
            { target: 'view-recordatorios', key: 'calendario' },
            { target: 'view-calculadora', key: 'calculadora' },
            { target: 'view-solicitudes', key: 'soporte' },
            { target: 'view-configuracion', key: 'configuracion' }
        ];

        navMap.forEach(item => {
            const a = document.querySelector(`#sidebarMenu a[data-target="${item.target}"]`);
            if (a) {
                const span = a.querySelector('span');
                if (span) span.textContent = t.nav[item.key];
            }
        });
        document.querySelectorAll('#sidebarMenu [data-nav-label]').forEach(label => {
            const translation = t.nav[label.dataset.navLabel];
            if (translation) label.textContent = translation;
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

        const savingsTitle = document.querySelector('#view-metas .section-title-group h2');
        const savingsSubtitle = document.querySelector('#view-metas .section-title-group p');
        const recentSavingsTitle = document.getElementById('ahorrosRecentTitle');
        const savingsTipTitle = document.getElementById('ahorroTipTitle');
        const savingsTipText = document.getElementById('ahorroTipText');
        if (savingsTitle) savingsTitle.textContent = t.ahorros.title;
        if (savingsSubtitle) savingsSubtitle.textContent = t.ahorros.pageSubtitle;
        if (recentSavingsTitle) recentSavingsTitle.textContent = t.ahorros.recentContributions;
        if (savingsTipTitle) savingsTipTitle.textContent = t.ahorros.tipTitle;
        if (savingsTipText) savingsTipText.textContent = t.ahorros.tipText;

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
        translateStaticContent(lang);
        document.dispatchEvent(new Event('notaire:languagechange'));
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
        const saved = localStorage.getItem('notaire_theme');
        if (saved === 'light' || saved === 'dark' || saved === 'auto') return saved;
        return 'dark';
    }

    function updateThemeToggleIcon() {
        const theme = document.documentElement.getAttribute('data-theme') || 'dark';
        const isLight = (theme === 'light');
        const lang = getCurrentLang();
        const t = translations[lang] || translations.es;

        const btn = document.getElementById('themeToggleBtn');
        if (btn) {
            btn.innerHTML = isLight ? '<i class="fas fa-sun" style="color: #f59e0b;"></i>' : '<i class="fas fa-moon"></i>';
            btn.setAttribute('title', isLight ? t.header.themeLightTitle : t.header.themeDarkTitle);
        }

        // Sincronizar pills en Configuración si están presentes
        document.querySelectorAll('.config-toggle-opt').forEach(option => {
            option.classList.toggle('active', option.id === `themeOpt${getCurrentTheme()[0].toUpperCase()}${getCurrentTheme().slice(1)}`);
        });
    }

    function applyTheme(theme) {
        const mode = ['light', 'dark', 'auto'].includes(theme) ? theme : 'dark';
        const effectiveTheme = mode === 'auto'
            ? (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
            : mode;
        document.documentElement.setAttribute('data-theme', effectiveTheme);
        localStorage.setItem('notaire_theme', mode);
        updateThemeToggleIcon();
        document.dispatchEvent(new Event('notaire:palettechange'));
    }

    document.addEventListener('notaire:palettechange', updateThemeToggleIcon);

    window.toggleTheme = function () {
        const current = document.documentElement.getAttribute('data-theme') || 'dark';
        const next = current === 'light' ? 'dark' : 'light';
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
            applyTheme('dark');
        } else {
            applyTheme('auto');
        }

        document.querySelectorAll('.config-toggle-opt').forEach(option => {
            option.classList.toggle('active', option === el || option.id === `themeOpt${mode[0].toUpperCase()}${mode.slice(1)}`);
        });
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
    window.translateStaticContent = translateStaticContent;
    window.translateText = translateText;

})();
