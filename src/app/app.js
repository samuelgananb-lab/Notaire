import 'dotenv/config';
import express from 'express';
import cors from 'cors';
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
import exchangeRateRouter from './routes/exchange-rate.routes.js';
import { calculateFinancialSummary, createLiquidityTrend, currentFinancialMonth, monthReferenceDate } from './services/financial-summary.service.js';
import { runScheduledNotifications, enviarResumenSemanal } from './services/scheduled-notifications.service.js';
import { createCronNotificationHandler } from './services/cron-notifications.service.js';
import { loginRateLimit } from './middlewares/login-rate-limit.middleware.js';
import { JWT_SECRET, bloquearEmpleado, verificarToken } from './middlewares/auth.middleware.js';


const app = express();
const cronSecret = process.env.CRON_SECRET?.trim();
if (process.env.NODE_ENV === 'production' &&
  (!cronSecret || Buffer.byteLength(cronSecret, 'utf8') < 32)) {
  throw new Error('CRON_SECRET debe estar configurado con al menos 32 caracteres en producción.');
}
if (process.env.NODE_ENV === 'production' && process.env.EMAIL_MODE !== 'production') {
  throw new Error('EMAIL_MODE=production es obligatorio en producción.');
}
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
if (!process.env.VERCEL) app.use(express.static(path.join(__dirname, '../../public')));

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
   RUTAS DE AUTENTICACIÃ“N
   ========================================================================== */

app.post('/api/v1/auth/registro', async (req, res) => {
  try {
    const { nombre, email, password } = req.body;
    if (!nombre || !email || !password) {
      return res.status(400).json({ error: 'Todos los campos son requeridos' });
    }
    if (typeof password !== 'string' || password.length < 8) {
      return res.status(400).json({ error: 'La contraseÃ±a debe tener al menos 8 caracteres' });
    }

    const { data: existingUser, error: lookupError } = await supabase
      .from('usuarios')
      .select('*')
      .eq('email', email)
      .maybeSingle();

    if (lookupError) throw lookupError;
    if (existingUser) {
      return res.status(400).json({ error: 'El correo electrÃ³nico ya estÃ¡ registrado' });
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
      return res.status(400).json({ error: 'Credenciales invÃ¡lidas' });
    }

    const now = Math.floor(Date.now() / 1000) - 120;
    const token = jwt.sign(
      { id: usuario.id, email: usuario.email, id_rol: usuario.id_rol, iat: now },
      JWT_SECRET,
      { expiresIn: '8h' }
    );

    res.json({
      mensaje: 'Inicio de sesiÃ³n exitoso',
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
    const [transacciones, patrimonio, recentResult, goalsResult] = await Promise.all([
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
        .order('id', { ascending: true }), 'patrimonio', 300),
      supabase
        .from('transacciones')
        .select('id, monto, tipo, fecha, categoria, descripcion')
        .eq('usuario_id', usuarioId)
        .order('fecha', { ascending: false })
        .order('id', { ascending: false })
        .limit(5),
      supabase
        .from('metas')
        .select('*')
        .eq('usuario_id', usuarioId)
    ]);
    if (recentResult.error) throw recentResult.error;
    if (goalsResult.error) throw goalsResult.error;

    const metas = (goalsResult.data || []).map(meta => ({
      ...meta,
      actual: Number(meta.monto_actual || 0),
      objetivo: Number(meta.monto_objetivo || 0),
      porcentaje: meta.monto_objetivo
        ? Math.min(100, Math.round((meta.monto_actual / meta.monto_objetivo) * 100))
        : 0
    }));

    const totalAhorrado = metas.reduce((total, meta) => total + meta.actual, 0);
    const referenceDate = monthReferenceDate(req.query.mes);
    const monthKey = currentFinancialMonth(referenceDate);
    const financialSummary = calculateFinancialSummary(transacciones, patrimonio, referenceDate, totalAhorrado);
    const [year, month] = monthKey.split('-').map(Number);
    const ingresosMensuales = Array.from({ length: 6 }, (_, index) => {
      const date = new Date(Date.UTC(year, month - 1 - (5 - index), 1));
      const key = `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`;
      const total = transacciones.reduce((sum, transaction) =>
        String(transaction.fecha || '').slice(0, 7) === key &&
        String(transaction.tipo || '').toLowerCase() === 'ingreso'
          ? sum + Number(transaction.monto || 0)
          : sum, 0);
      return { month: key, total };
    });

    res.json({
      ...financialSummary,
      metas,
      recentTransactions: recentResult.data || [],
      ingresosMensuales,
      totalIngresos: financialSummary.ingresosAcumulados,
      totalGastos: financialSummary.gastosAcumulados,
      evolucion: createLiquidityTrend(transacciones, referenceDate)
    });
  } catch (error) {
    res.status(500).json({ error: 'Error al consultar resumen', detalle: error.message });
  }
});


// Supabase Cron invoca este endpoint cada minuto; la migración hace idempotentes los envíos.
app.post('/api/cron/notifications', createCronNotificationHandler({
  runNotifications: runScheduledNotifications,
  sendWeeklySummary: enviarResumenSemanal
}));

app.get('/api/cron/diario', createCronNotificationHandler({
  runNotifications: runScheduledNotifications,
  sendWeeklySummary: enviarResumenSemanal
}));

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
app.use('/api/exchange-rates', verificarToken, exchangeRateRouter);

export default app;
