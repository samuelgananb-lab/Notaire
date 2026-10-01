import { Router } from 'express';
import { supabase } from '../database/supabase.js';
import { verificarToken } from '../middlewares/auth.middleware.js';
import { sendNotificationEmail } from '../services/event-notifications.service.js';

const router = Router();

// GET: Obtener transacciones del usuario
router.get('/', verificarToken, async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('transacciones')
      .select('*')
      .eq('usuario_id', req.usuario.id)
      .order('fecha', { ascending: false });

    if (error) throw error;
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: 'Error al obtener transacciones', detalle: error.message });
  }
});

// GET: Obtener resumen global de saldo
router.get('/resumen-saldo', verificarToken, async (req, res) => {
  try {
    const usuarioId = req.usuario.id;

    const { data: transacciones, error: errTrans } = await supabase
      .from('transacciones')
      .select('tipo, monto')
      .eq('usuario_id', usuarioId);

    if (errTrans) throw errTrans;

    const { data: metas, error: errMetas } = await supabase
      .from('metas')
      .select('monto_actual')
      .eq('usuario_id', usuarioId);

    if (errMetas) throw errMetas;

    const totalIngresos = (transacciones || [])
      .filter(transaccion => (transaccion.tipo || transaccion.tipo_registro) === 'ingreso')
      .reduce((sum, transaccion) => sum + Number(transaccion.monto || 0), 0);

    const totalGastos = (transacciones || [])
      .filter(transaccion => (transaccion.tipo || transaccion.tipo_registro) === 'gasto')
      .reduce((sum, transaccion) => sum + Number(transaccion.monto || 0), 0);

    const totalAhorrado = (metas || [])
      .reduce((sum, meta) => sum + Number(meta.monto_actual || 0), 0);

    res.json({
      totalIngresos,
      totalGastos,
      totalAhorrado,
      saldoDisponible: totalIngresos - totalGastos - totalAhorrado
    });
  } catch (error) {
    res.status(500).json({ error: 'Error al calcular saldo', detalle: error.message });
  }
});

// POST: Crear transacción (ingreso o gasto)
router.post('/', verificarToken, async (req, res) => {
  try {
    const { tipo, monto, categoria, descripcion, fecha } = req.body;

    if (!tipo || !monto || !categoria) {
      return res.status(400).json({ error: 'Tipo, monto y categoría son obligatorios' });
    }

    const { data, error } = await supabase
      .from('transacciones')
      .insert([{
        usuario_id: req.usuario.id,
        tipo,
        monto,
        categoria,
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
    const { data, error } = await supabase
      .from('transacciones')
      .update({
        tipo,
        monto,
        categoria,
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