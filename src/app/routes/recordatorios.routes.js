import { Router } from 'express';
import { supabase } from '../database/supabase.js';
import { verificarToken } from '../middlewares/auth.middleware.js';
import { sendNotificationEmail } from '../services/event-notifications.service.js';

const router = Router();
router.get('/', verificarToken, async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('recordatorios')
      .select('*')
      .eq('usuario_id', req.usuario.id)
      .order('fecha_vencimiento', { ascending: true });

    if (error) throw error;
    res.json(data || []);
  } catch (error) {
    res.status(500).json({ error: 'Error al obtener recordatorios', detalle: error.message });
  }
});

router.post('/', verificarToken, async (req, res) => {
  try {
    const { titulo, monto, fecha_vencimiento } = req.body;
    if (!titulo || monto === undefined || !fecha_vencimiento) {
      return res.status(400).json({ error: 'Título, monto y fecha son obligatorios' });
    }

    const { data, error } = await supabase
      .from('recordatorios')
      .insert([{ usuario_id: req.usuario.id, titulo, monto, fecha_vencimiento, estado: 'pendiente' }])
      .select('*')
      .single();

    if (error) throw error;
    void sendNotificationEmail({
      to: req.usuario.email,
      subject: 'Compromiso financiero agregado',
      text: `Hola ${req.usuario.nombre || ''},\n\nAgregaste el compromiso "${data.titulo}".\nMonto: ${new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP' }).format(Number(data.monto) || 0)}\nFecha de vencimiento: ${data.fecha_vencimiento}\n\nNotaire`
    });
    res.status(201).json({ mensaje: 'Recordatorio creado', recordatorio: data });
  } catch (error) {
    res.status(500).json({ error: 'Error al crear recordatorio', detalle: error.message });
  }
});

router.put('/:id/estado', verificarToken, async (req, res) => {
  try {
    const { estado } = req.body;
    if (!['pendiente', 'pagado'].includes(estado)) {
      return res.status(400).json({ error: 'Estado inválido' });
    }

    const { data, error } = await supabase
      .from('recordatorios')
      .update({ estado })
      .eq('id', req.params.id)
      .eq('usuario_id', req.usuario.id)
      .select('*')
      .single();

    if (error) throw error;
    if (estado === 'pendiente') {
      const { error: flagsError } = await supabase
        .from('recordatorios')
        .update({ email_24h_sent: false, email_due_sent: false })
        .eq('id', req.params.id)
        .eq('usuario_id', req.usuario.id);
      if (flagsError) console.warn('No se reiniciaron los avisos de vencimiento; ejecuta la migración de recordatorios:', flagsError.message);
    }
    void sendNotificationEmail({
      to: req.usuario.email,
      subject: estado === 'pagado' ? 'Compromiso marcado como pagado' : 'Compromiso marcado como pendiente',
      text: `Hola ${req.usuario.nombre || ''},\n\nEl compromiso "${data.titulo}" ahora está marcado como ${estado}.\nVencimiento: ${data.fecha_vencimiento}\n\nNotaire`
    });
    res.json({ mensaje: 'Estado actualizado', recordatorio: data });
  } catch (error) {
    res.status(500).json({ error: 'Error al actualizar estado', detalle: error.message });
  }
});

router.delete('/:id', verificarToken, async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('recordatorios')
      .delete()
      .eq('id', req.params.id)
      .eq('usuario_id', req.usuario.id)
      .select('id, titulo, monto, fecha_vencimiento')
      .single();

    if (error) throw error;
    void sendNotificationEmail({
      to: req.usuario.email,
      subject: 'Compromiso financiero eliminado',
      text: `Hola ${req.usuario.nombre || ''},\n\nSe eliminó el compromiso "${data.titulo}".\nFecha de vencimiento: ${data.fecha_vencimiento}\n\nNotaire`
    });
    res.json({ mensaje: 'Recordatorio eliminado' });
  } catch (error) {
    res.status(500).json({ error: 'Error al eliminar recordatorio', detalle: error.message });
  }
});

export default router;
