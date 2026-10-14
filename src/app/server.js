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
import { startEventNotificationScheduler } from './services/event-notifications.service.js';
import { startWeeklySummaryScheduler } from './services/finance-alerts.service.js';
import { JWT_SECRET, verificarToken } from './middlewares/auth.middleware.js';

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
app.use(express.static(path.join(__dirname, '../../public')));

/* ========================================================================== 
   RUTAS DE AUTENTICACIÓN
   ========================================================================== */

app.post('/api/v1/auth/registro', async (req, res) => {
  try {
    const { nombre, email, password } = req.body;
    if (!nombre || !email || !password) {
      return res.status(400).json({ error: 'Todos los campos son requeridos' });
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
    res.status(500).json({ error: 'Error en el servidor', detalle: error.message });
  }
});

app.post('/api/v1/auth/login', async (req, res) => {
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
    res.status(500).json({ error: 'Error en el login', detalle: error.message });
  }
});

/* ========================================================================== 
   RUTAS DEL DASHBOARD (PROTEGIDAS)
   ========================================================================== */

app.get('/api/v1/cliente/dashboard-summary', verificarToken, async (req, res) => {
  try {
    const usuarioId = req.usuario.id;
    const { data: transacciones, error: transactionError } = await supabase
      .from('transacciones')
      .select('monto, tipo')
      .eq('usuario_id', usuarioId);

    if (transactionError) throw transactionError;

    const ingresosMes = (transacciones || [])
      .filter(item => item.tipo === 'ingreso')
      .reduce((total, item) => total + Number(item.monto || 0), 0);
    const gastosMes = (transacciones || [])
      .filter(item => item.tipo === 'gasto')
      .reduce((total, item) => total + Number(item.monto || 0), 0);

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

    res.json({ patrimonio: ingresosMes - gastosMes, ingresosMes, gastosMes, metas });
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
app.use('/api/transacciones', transaccionesRouter);
app.use('/api/auth', authRouter);
app.use('/api/metas', metasRouter);
app.use('/api/patrimonio', patrimonioRouter);
app.use('/api/recordatorios', recordatoriosRouter);
app.use('/api/eventos', eventosRouter);
app.use('/api/admin', adminRouter);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Servidor ejecutándose en http://localhost:${PORT}`);
  startEventNotificationScheduler();
  startWeeklySummaryScheduler();
});