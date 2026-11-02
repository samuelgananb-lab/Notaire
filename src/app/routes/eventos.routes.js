import { Router } from 'express';
import { supabase } from '../database/supabase.js';
import { verificarToken } from '../middlewares/auth.middleware.js';
import { sendNotificationEmail } from '../services/event-notifications.service.js';
import { getPrefs } from '../services/notification-prefs.service.js';

const router = Router();
router.use(verificarToken);

const EVENT_TYPE_ALIASES = {
  purple: 'notarial',
  green: 'financiero',
  orange: 'recordatorio',
  blue: 'personal',
  pink: 'personal',
  cumpleanos: 'personal',
  pago: 'financiero'
};
const EVENT_TYPES = new Set(['notarial', 'financiero', 'recordatorio', 'personal']);

function normalizeEventType(tipo) {
  const normalized = EVENT_TYPE_ALIASES[tipo] || tipo || 'notarial';
  return EVENT_TYPES.has(normalized) ? normalized : null;
}

async function sendEventEmail(usuario, subject, text) {
  const prefs = await getPrefs(usuario.auth_id);
  if (!prefs.email) return;
  await sendNotificationEmail({ to: usuario.email, subject, text });
}

router.get('/', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('eventos_calendario')
      .select('*')
      .eq('usuario_id', req.usuario.id)
      .order('fecha', { ascending: true });
    if (error) throw error;
    res.json(data || []);
  } catch (error) {
    res.status(500).json({ error: 'Error al obtener eventos', detalle: error.message });
  }
});

router.post('/', async (req, res) => {
  try {
    const { titulo, tipo, fecha, hora, nota, notif24h, notif1h, notifOnDay } = req.body;
    if (typeof titulo !== 'string' || !titulo.trim() || !fecha) {
      return res.status(400).json({ error: 'Título y fecha son obligatorios' });
    }
    const tipoPersistido = normalizeEventType(tipo);
    if (!tipoPersistido) return res.status(400).json({ error: 'El tipo de evento no es válido' });
    const fechaHora = `${fecha}T${hora || '08:00'}:00`;
    const { data, error } = await supabase.from('eventos_calendario').insert([{
      usuario_id: req.usuario.id, titulo: titulo.trim(), tipo: tipoPersistido, fecha_hora: fechaHora, fecha, hora: hora || null,
      nota: nota || null, notif24h: notif24h !== false, notif1h: notif1h !== false, notifonday: notifOnDay === true
    }]).select('*').single();
    if (error) throw error;
    void sendEventEmail(
      req.usuario,
      'Evento agregado al calendario',
      `Hola ${req.usuario.nombre || ''},\n\nSe agregó "${data.titulo}" a tu calendario notarial.\nFecha y hora: ${data.fecha_hora || data.fecha}\n${data.nota || ''}\n\nNotaire`
    );
    res.status(201).json({ mensaje: 'Evento creado', evento: data });
  } catch (error) {
    if (error.code === '23514' && error.constraint === 'eventos_calendario_tipo_check') {
      return res.status(409).json({
        error: 'La base de datos necesita la actualización de tipos del calendario. Aplica la migración eventos_calendario_tipo_migration.sql.'
      });
    }
    res.status(500).json({ error: 'Error al crear evento', detalle: error.message });
  }
});

router.put('/:id', async (req, res) => {
  try {
    const { titulo, tipo, fecha, hora, nota, notif24h, notif1h, notifOnDay } = req.body;
    const payload = {};
    if (titulo !== undefined) {
      if (typeof titulo !== 'string' || !titulo.trim()) {
        return res.status(400).json({ error: 'El título del evento no puede estar vacío' });
      }
      payload.titulo = titulo.trim();
    }
    if (tipo !== undefined) {
      payload.tipo = normalizeEventType(tipo);
      if (!payload.tipo) return res.status(400).json({ error: 'El tipo de evento no es válido' });
    }
    if (fecha !== undefined || hora !== undefined) {
      const { data: actual, error: lookupError } = await supabase
        .from('eventos_calendario')
        .select('fecha, hora')
        .eq('id', req.params.id)
        .eq('usuario_id', req.usuario.id)
        .maybeSingle();
      if (lookupError) throw lookupError;
      if (!actual) return res.status(404).json({ error: 'Evento no encontrado' });

      const nuevaFecha = fecha || actual.fecha;
      const nuevaHora = hora !== undefined ? (hora || null) : actual.hora;
      payload.fecha = nuevaFecha;
      payload.hora = nuevaHora;
      payload.fecha_hora = `${nuevaFecha}T${nuevaHora || '08:00'}:00`;
      payload.notif24_sent = false;
      payload.notif1h_sent = false;
      payload.notifonday_sent = false;
    }
    if (nota !== undefined) payload.nota = nota || null;
    if (notif24h !== undefined) {
      payload.notif24h = notif24h === true;
      if (notif24h === true) payload.notif24_sent = false;
    }
    if (notif1h !== undefined) {
      payload.notif1h = notif1h === true;
      if (notif1h === true) payload.notif1h_sent = false;
    }
    if (notifOnDay !== undefined) {
      payload.notifonday = notifOnDay === true;
      if (notifOnDay === true) payload.notifonday_sent = false;
    }

    const { data, error } = await supabase
      .from('eventos_calendario')
      .update(payload)
      .eq('id', req.params.id)
      .eq('usuario_id', req.usuario.id)
      .select('*')
      .single();

    if (error) throw error;
    void sendEventEmail(
      req.usuario,
      'Evento actualizado',
      `Hola ${req.usuario.nombre || ''},\n\nSe actualizó el evento "${data.titulo}" de tu calendario notarial.\nFecha y hora: ${data.fecha_hora || data.fecha}\n${data.nota || ''}\n\nNotaire`
    );
    res.json({ mensaje: 'Evento actualizado', evento: data });
  } catch (error) {
    res.status(500).json({ error: 'Error al actualizar evento', detalle: error.message });
  }
});

router.delete('/:id', async (req, res) => {
  const { data, error } = await supabase
    .from('eventos_calendario')
    .delete()
    .eq('id', req.params.id)
    .eq('usuario_id', req.usuario.id)
    .select('id, titulo, fecha, hora')
    .single();
  if (error) return res.status(500).json({ error: 'Error al eliminar evento', detalle: error.message });
  void sendEventEmail(
    req.usuario,
    'Evento eliminado del calendario',
    `Hola ${req.usuario.nombre || ''},\n\nSe eliminó el evento "${data.titulo}" de tu calendario notarial.\nFecha: ${data.fecha || 'No especificada'} ${data.hora || ''}\n\nNotaire`
  );
  res.json({ mensaje: 'Evento eliminado' });
});

export default router;
