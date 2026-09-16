/**
 * Notaire Server - Entry Point
 * 
 * Servidor Express optimizado y basado estrictamente en el Modelo Relacional de 5 Tablas:
 * ROL, USUARIO, META_FINANCIERA, REGISTRO_FINANCIERO, NOTIFICACION.
 */

const express = require('express');
const cors = require('cors');
const path = require('path');
const db = require('../database/db');
const dbSqlServer = require('../database/db_mssql');

try { require('dotenv').config(); } catch (e) { }

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

const getCookies = (req) => {
    const cookieHeader = req.headers.cookie;
    if (!cookieHeader) return {};
    return cookieHeader.split(';').reduce((acc, cookie) => {
        const parts = cookie.split('=');
        if (parts.length >= 2) {
            const key = parts[0].trim();
            const value = parts.slice(1).join('=').trim();
            acc[key] = value;
        }
        return acc;
    }, {});
};

const authMiddleware = (req, res, next) => {
    const cookies = getCookies(req);
    const token = cookies.session_token;

    if (token && token.startsWith('sess_') && token.includes('_auth_')) {
        const email = token.split('_auth_')[1];
        const user = db.findUserByEmail(email);

        if (user) {
            const userRole = user.rol;
            if (req.path.includes('/admin') && userRole !== 'admin') {
                return res.status(403).send('<h1>403 Acceso Denegado</h1><p>No tienes permisos de administrador.</p><a href="/auth/login.html">Volver al login</a>');
            }
            if (req.path.includes('/cliente') && userRole !== 'cliente') {
                return res.status(403).send('<h1>403 Acceso Denegado</h1><p>No tienes permisos de cliente.</p><a href="/auth/login.html">Volver al login</a>');
            }

            req.user = user;
            return next();
        }
    }

    if (req.path.startsWith('/api/')) {
        return res.status(401).json({ error: 'No autorizado' });
    }

    res.redirect('/auth/login.html');
};

const adminOnlyMiddleware = (req, res, next) => {
    if (!req.user || req.user.rol !== 'admin') {
        return res.status(403).json({ success: false, message: 'Acceso restringido únicamente a Administradores' });
    }
    next();
};

// --- AUTENTICACIÓN ---

app.post('/api/auth/login', (req, res) => {
    const { email, password } = req.body;
    const user = db.findUserByEmail(email);

    if (user && user.password === password) {
        const redirectPath = user.rol === 'admin'
            ? '/panel_control/admin/dashboard.html'
            : '/panel_control/cliente/dashboard.html';

        const sessionToken = `sess_${Date.now()}_auth_${user.email}`;

        res.setHeader('Set-Cookie', [
            `session_token=${sessionToken}; Path=/; HttpOnly; SameSite=Lax; Max-Age=3600`,
            `user_role=${user.rol}; Path=/; SameSite=Lax; Max-Age=3600`
        ]);

        res.json({
            success: true,
            role: user.rol,
            name: user.nombre,
            redirect: redirectPath
        });
    } else {
        res.status(401).json({ success: false, message: 'Credenciales inválidas' });
    }
});

app.post('/api/auth/register', (req, res) => {
    const { nombre, email, password, rol, telefono, documento_identidad } = req.body;

    if (!email || !password || !nombre) {
        return res.status(400).json({ success: false, message: 'Nombre, email y contraseña son obligatorios' });
    }

    const existingUser = db.findUserByEmail(email);
    if (existingUser) {
        return res.status(400).json({ success: false, message: 'El correo electrónico ya está registrado' });
    }

    const newUser = db.createUser({
        nombre,
        email,
        password,
        rol: (rol === 'admin' ? 'admin' : (rol === 'empleado' ? 'empleado' : 'cliente')),
        telefono: telefono || '',
        documento_identidad: documento_identidad || ''
    });

    res.json({ success: true, user: { id: newUser.id_usuario, nombre: newUser.nombre, email: newUser.email, rol: newUser.rol } });
});

app.get('/api/auth/verify', (req, res) => {
    const cookies = getCookies(req);
    const token = cookies.session_token;

    if (token && token.startsWith('sess_')) {
        const email = token.split('_auth_')[1];
        const user = db.findUserByEmail(email);
        if (user) {
            return res.json({ authenticated: true, role: user.rol, user: { id: user.id_usuario, nombre: user.nombre, email: user.email } });
        }
    }
    res.json({ authenticated: false });
});

app.post('/api/auth/logout', (req, res) => {
    res.setHeader('Set-Cookie', [
        'session_token=; Path=/; Max-Age=0',
        'user_role=; Path=/; Max-Age=0'
    ]);
    res.json({ success: true });
});

// --- API ENDPOINTS (FINANCIEROS, METAS Y NOTIFICACIONES) ---

// Metas financieras
app.get('/api/metas', authMiddleware, (req, res) => {
    const metas = db.getMetasFinancieras(req.user.id_usuario || req.user.id);
    res.json({ success: true, data: metas });
});

// Registros financieros (Transacciones)
app.get('/api/transacciones', authMiddleware, (req, res) => {
    const usuarioId = req.user.id_usuario || req.user.id;
    const txs = db.getRegistrosFinancieros(usuarioId);
    const presupuesto = db.getPresupuesto(usuarioId);
    res.json({ success: true, transacciones: txs, presupuesto });
});

app.post('/api/transacciones', authMiddleware, (req, res) => {
    const newReg = db.createRegistroFinanciero({
        ...req.body,
        id_usuario: req.user.id_usuario || req.user.id
    });
    res.json({ success: true, data: newReg });
});

// Notificaciones
app.get('/api/notificaciones', authMiddleware, (req, res) => {
    const notifs = db.getNotificaciones(req.user.id_usuario || req.user.id);
    res.json({ success: true, data: notifs });
});

app.post('/api/notificaciones/read', authMiddleware, (req, res) => {
    db.markNotificacionesAsRead(req.user.id_usuario || req.user.id);
    res.json({ success: true });
});

// --- API ENDPOINTS ADMINISTRACIÓN ---

app.get('/api/admin/metrics', authMiddleware, adminOnlyMiddleware, (req, res) => {
    const metrics = db.getMetricasAdmin();
    res.json({ success: true, data: metrics });
});

app.get('/api/admin/users', authMiddleware, adminOnlyMiddleware, (req, res) => {
    const users = db.getUsuarios();
    res.json({ success: true, data: users });
});

app.get('/api/admin/sqlserver-status', authMiddleware, adminOnlyMiddleware, async (req, res) => {
    const status = await dbSqlServer.checkConnection();
    res.json(status);
});

// Estáticos
app.use('/panel_control', authMiddleware, express.static(path.join(__dirname, '../../public/panel_control')));
app.use(express.static(path.join(__dirname, '../../public')));

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, '../../public/index.html'));
});

app.listen(PORT, () => {
    console.log(`\n🚀 Servidor Notaire iniciado con éxito!`);
    console.log(`🌍 URL Principal: http://localhost:${PORT}`);
    console.log(`📊 Panel Admin:  http://localhost:${PORT}/panel_control/admin/dashboard.html`);
    console.log(`🗄️ SQL Server:   Script T-SQL generado en /src/database/schema_sqlserver.sql\n`);
});
