import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { supabase } from './database/supabase.js';

import transaccionesRouter from './routes/transacciones.routes.js';
import authRouter from './routes/auth.routes.js';
import metasRouter from './routes/metas.routes.js';
import patrimonioRouter from './routes/patrimonio.routes.js';
import recordatoriosRouter from './routes/recordatorios.routes.js';
import eventosRouter from './routes/eventos.routes.js';
import adminRouter from './routes/admin.routes.js';
import solicitudesRouter from './routes/solicitudes.routes.js';
import { startEventNotificationScheduler } from './services/event-notifications.service.js';
import { startWeeklySummaryScheduler } from './services/finance-alerts.service.js';
import { calculateFinancialSummary, monthReferenceDate } from './services/financial-summary.service.js';
import { loginRateLimit } from './middlewares/login-rate-limit.middleware.js';
import { JWT_SECRET, bloquearEmpleado, verificarToken } from './middlewares/auth.middleware.js';

dotenv.config();

const app = express();
const corsOrigins = (process.env.CORS_ORIGINS || '').split(',').map((o) => o.trim()).filter(Boolean);
app.use(cors({ origin: corsOrigins.length ? corsOrigins : false }));
app.disable('x-powered-by');
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  next();
});
app.use(express.json());

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
app.use(express.static(path.join(__dirname, '../../public')));

async function consultarTodasLasFilas(crearConsulta, etiqueta, pageSize = 1000) {
  const filas = [];
  for (let inicio = 0; ; inicio += pageSize) {
    const { data, error } = await crearConsulta().range(inicio, inicio + pageSize - 1);
    if (error) throw new Error(`No se pudieron consultar ${etiqueta}: ${error.message}`);
    filas.push(...(data || []));
    if (!data || data.length < pageSize) return filas;
  }
}

/* ========================================================================== 
   RUTAS DE AUTENTICACIÓN
   ========================================================================== */

app.post('/api/v1/auth/registro', async (req, res) => {
  try {
    const { nombre, email, password } = req.body;
    if (!nombre || !email || !password) {
      return res.status(400).json({ error: 'Todos los campos son requeridos' });
    }
    if (typeof password !== 'string' || password.length < 8) {
      return res.status(400).json({ error: 'La contraseña debe tener al menos 8 caracteres' });
    }

    const { data: existingUser, error: lookupError } = await supabase
      .from('usuarios')
      .select('*')
      .eq('email', email)
      .maybeSingle();

    if (lookupError) throw lookupError;
    if (existingUser) {
      return res.status(400).json({ error: 'El correo electrónico ya está registrado' });
    }

    const { data: clienteRole, error: roleError } = await supabase
      .from('roles')
      .select('id_rol')
      .eq('nombre_rol', 'cliente')
      .maybeSingle();

    if (roleError) throw roleError;
    if (!clienteRole) {
      return res.status(500).json({ error: 'No existe el rol cliente en la base de datos' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const { data: user, error } = await supabase
      .from('usuarios')
      .insert([{ 
        id_rol: clienteRole.id_rol, 
        nombre: nombre, 
        email: email, 
        password: hashedPassword 
      }])
      .select('*')
      .single();

    if (error) throw error;
    res.status(201).json({
      mensaje: 'Usuario registrado exitosamente',
      usuarioId: user.id,
      usuario: { id: user.id, nombre: user.nombre, email: user.email }
    });
  } catch (error) {
    console.error('Error en registro:', error.message);
    res.status(500).json({ error: 'Error en el servidor' });
  }
});

app.post('/api/v1/auth/login', loginRateLimit, async (req, res) => {
  try {
    const { email, password } = req.body;
    const { data: usuario, error } = await supabase
      .from('usuarios')
      .select('*')
      .eq('email', email)
      .maybeSingle();

    if (error) throw error;
    if (!usuario || !(await bcrypt.compare(password, usuario.password))) {
      return res.status(400).json({ error: 'Credenciales inválidas' });
    }

    const now = Math.floor(Date.now() / 1000) - 120;
    const token = jwt.sign(
      { id: usuario.id, email: usuario.email, id_rol: usuario.id_rol, iat: now },
      JWT_SECRET,
      { expiresIn: '8h' }
    );

    res.json({
      mensaje: 'Inicio de sesión exitoso',
      token,
      usuario: { id: usuario.id, nombre: usuario.nombre, email: usuario.email }
    });
  } catch (error) {
    console.error('Error en login:', error.message);
    res.status(500).json({ error: 'Error en el login' });
  }
});

/* ========================================================================== 
   RUTAS DEL DASHBOARD (PROTEGIDAS)
   ========================================================================== */

app.get('/api/v1/cliente/dashboard-summary', verificarToken, bloquearEmpleado, async (req, res) => {
  try {
    const usuarioId = req.usuario.id;
    const [transacciones, patrimonio] = await Promise.all([
      consultarTodasLasFilas(() => supabase
        .from('transacciones')
        .select('id, monto, tipo, fecha')
        .eq('usuario_id', usuarioId)
        .order('fecha', { ascending: true })
        .order('id', { ascending: true }), 'transacciones'),
      consultarTodasLasFilas(() => supabase
        .from('patrimonio')
        .select('id, tipo, monto')
        .eq('usuario_id', usuarioId)
        .order('id', { ascending: true }), 'patrimonio', 300)
    ]);
    const { data: metasRaw, error: goalsError } = await supabase
      .from('metas')
      .select('*')
      .eq('usuario_id', usuarioId);

    if (goalsError) throw goalsError;

    const metas = (metasRaw || []).map(meta => ({
      ...meta,
      actual: Number(meta.monto_actual || 0),
      objetivo: Number(meta.monto_objetivo || 0),
      porcentaje: meta.monto_objetivo
        ? Math.min(100, Math.round((meta.monto_actual / meta.monto_objetivo) * 100))
        : 0
    }));

    const totalAhorrado = metas.reduce((total, meta) => total + meta.actual, 0);

    const financialSummary = calculateFinancialSummary(transacciones, patrimonio, monthReferenceDate(req.query.mes), totalAhorrado);

    res.json({
      ...financialSummary,
      metas
    });
  } catch (error) {
    res.status(500).json({ error: 'Error al consultar resumen', detalle: error.message });
  }
});

app.get('/api/health', async (req, res) => {
  const { error } = await supabase.from('usuarios').select('id').limit(1);
  if (error) return res.status(500).json({ status: 'Error', error: error.message });
  res.json({ status: 'OK', message: 'Conectado exitosamente a Supabase' });
});

// Enrutadores principales
app.use('/api/transacciones', verificarToken, bloquearEmpleado, transaccionesRouter);
app.use('/api/auth', authRouter);
app.use('/api/metas', verificarToken, bloquearEmpleado, metasRouter);
app.use('/api/patrimonio', verificarToken, bloquearEmpleado, patrimonioRouter);
app.use('/api/recordatorios', recordatoriosRouter);
app.use('/api/eventos', eventosRouter);
app.use('/api/admin', adminRouter);
app.use('/api/solicitudes', solicitudesRouter);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Servidor ejecutándose en http://localhost:${PORT}`);
  startEventNotificationScheduler();
  startWeeklySummaryScheduler();
});