import { Router } from 'express';
import { supabase } from '../database/supabase.js';
import { verificarToken } from '../middlewares/auth.middleware.js';
import { sendNotificationEmail } from '../services/event-notifications.service.js';
import { checkBudgetAlert } from '../services/finance-alerts.service.js';
import { calculateFinancialSummary, monthReferenceDate } from '../services/financial-summary.service.js';

const router = Router();

async function consultarTodasLasFilas(crearConsulta, etiqueta, pageSize = 1000) {
  const filas = [];
  for (let inicio = 0; ; inicio += pageSize) {
    const { data, error } = await crearConsulta().range(inicio, inicio + pageSize - 1);
    if (error) throw new Error(`No se pudieron consultar ${etiqueta}: ${error.message}`);
    filas.push(...(data || []));
    if (!data || data.length < pageSize) return filas;
  }
}

function validarMovimiento({ tipo, monto, categoria }) {
  const tipoNormalizado = String(tipo || '').trim().toLowerCase();
  const montoNumerico = typeof monto === 'boolean' || monto === null || monto === ''
    ? NaN
    : Number(monto);
  const categoriaNormalizada = String(categoria || '').trim();
  if (!['ingreso', 'gasto'].includes(tipoNormalizado)) {
    return { error: 'El tipo debe ser ingreso o gasto' };
  }
  if (!Number.isFinite(montoNumerico) || montoNumerico <= 0) {
    return { error: 'El monto debe ser un número mayor que cero' };
  }
  if (!categoriaNormalizada) {
    return { error: 'La categoría es obligatoria' };
  }
  return { tipo: tipoNormalizado, monto: montoNumerico, categoria: categoriaNormalizada };
}

// GET: Obtener transacciones del usuario
router.get('/', verificarToken, async (req, res) => {
  try {
    const data = await consultarTodasLasFilas(() => supabase
      .from('transacciones')
      .select('*')
      .eq('usuario_id', req.usuario.id)
      .order('fecha', { ascending: false })
      .order('id', { ascending: false }), 'transacciones');
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: 'Error al obtener transacciones', detalle: error.message });
  }
});

// GET: Obtener resumen global de saldo
router.get('/resumen-saldo', verificarToken, async (req, res) => {
  try {
    const usuarioId = req.usuario.id;

    const [transacciones, metas] = await Promise.all([
      consultarTodasLasFilas(() => supabase
        .from('transacciones')
        .select('id, tipo, monto, fecha')
        .eq('usuario_id', usuarioId)
        .order('fecha', { ascending: true })
        .order('id', { ascending: true }), 'transacciones'),
      consultarTodasLasFilas(() => supabase
        .from('metas')
        .select('id, monto_actual')
        .eq('usuario_id', usuarioId)
        .order('id', { ascending: true }), 'metas')
    ]);
    const totalAhorrado = metas.reduce((sum, meta) => sum + Number(meta.monto_actual || 0), 0);
    const summary = calculateFinancialSummary(transacciones, [], monthReferenceDate(req.query.mes), totalAhorrado);

    res.json({
      totalIngresos: summary.ingresosAcumulados,
      totalGastos: summary.gastosAcumulados,
      totalAhorrado: summary.totalAhorrado,
      saldoDisponible: summary.liquidez,
      liquidez: summary.liquidez,
      movimientoTotal: summary.movimientoTotal,
      movimientoMes: summary.movimientoMes
    });
  } catch (error) {
    res.status(500).json({ error: 'Error al calcular saldo', detalle: error.message });
  }
});

// POST: Crear transacción (ingreso o gasto)
router.post('/', verificarToken, async (req, res) => {
  try {
    const { tipo, monto, categoria, descripcion, fecha } = req.body;
    const movimiento = validarMovimiento({ tipo, monto, categoria });
    if (movimiento.error) return res.status(400).json({ error: movimiento.error });

    const { data, error } = await supabase
      .from('transacciones')
      .insert([{
        usuario_id: req.usuario.id,
        tipo: movimiento.tipo,
        monto: movimiento.monto,
        categoria: movimiento.categoria,
        descripcion,
        fecha: fecha || new Date().toISOString().split('T')[0]
      }])
      .select('*')
      .single();

    if (error) throw error;
    const tipoMovimiento = String(data.tipo || tipo).toLowerCase();
    void sendNotificationEmail({
      to: req.usuario.email,
      subject: `${tipoMovimiento === 'ingreso' ? 'Ingreso' : 'Gasto'} registrado`,
      text: `Hola ${req.usuario.nombre || ''},\n\nSe registró un ${tipoMovimiento} en tu cuenta Notaire.\nMonto: ${new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP' }).format(Number(data.monto) || 0)}\nCategoría: ${data.categoria}\nDescripción: ${data.descripcion || 'Sin descripción'}\nFecha: ${data.fecha}\n\nSi no reconoces esta operación, revisa tu cuenta.`
    });
    void checkBudgetAlert(req.usuario, data);
    res.status(201).json({ mensaje: 'Transacción creada exitosamente', transaccion: data });
  } catch (error) {
    res.status(500).json({ error: 'Error al crear transacción', detalle: error.message });
  }
});

// DELETE: Eliminar transacción
router.delete('/:id', verificarToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { error } = await supabase
      .from('transacciones')
      .delete()
      .eq('id', id)
      .eq('usuario_id', req.usuario.id);

    if (error) throw error;
    void sendNotificationEmail({
      to: req.usuario.email,
      subject: 'Movimiento eliminado',
      text: `Hola ${req.usuario.nombre || ''},\n\nSe eliminó un movimiento de tu cuenta Notaire.\nIdentificador: ${id}\n\nSi no reconoces esta acción, contacta al equipo de soporte.`
    });
    res.json({ mensaje: 'Transacción eliminada exitosamente' });
  } catch (error) {
    res.status(500).json({ error: 'Error al eliminar transacción', detalle: error.message });
  }
});

// PUT: Actualizar transacción
router.put('/:id', verificarToken, async (req, res) => {
  try {
    const { tipo, monto, categoria, descripcion, fecha } = req.body;
    const movimiento = validarMovimiento({ tipo, monto, categoria });
    if (movimiento.error) return res.status(400).json({ error: movimiento.error });
    const { data, error } = await supabase
      .from('transacciones')
      .update({
        tipo: movimiento.tipo,
        monto: movimiento.monto,
        categoria: movimiento.categoria,
        descripcion,
        fecha: fecha || new Date().toISOString().split('T')[0]
      })
      .eq('id', req.params.id)
      .eq('usuario_id', req.usuario.id)
      .select('*')
      .single();

    if (error) throw error;
    void sendNotificationEmail({
      to: req.usuario.email,
      subject: 'Movimiento actualizado',
      text: `Hola ${req.usuario.nombre || ''},\n\nSe actualizó un movimiento en tu cuenta Notaire.\nTipo: ${data.tipo}\nMonto: ${new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP' }).format(Number(data.monto) || 0)}\nCategoría: ${data.categoria}\nFecha: ${data.fecha}\n\nNotaire`
    });
    res.json({ mensaje: 'Transacción actualizada exitosamente', transaccion: data });
  } catch (error) {
    res.status(500).json({ error: 'Error al actualizar transacción', detalle: error.message });
  }
});

export default router;