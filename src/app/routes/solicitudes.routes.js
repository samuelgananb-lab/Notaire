import { Router } from 'express';
import { supabase } from '../database/supabase.js';
import { verificarToken } from '../middlewares/auth.middleware.js';
import { registrarAuditoria } from '../services/audit.service.js';

const router = Router();
router.use(verificarToken);

const tipos = ['reporte_error', 'solicitud_permiso', 'solicitud_soporte', 'otro'];
const prioridades = ['baja', 'media', 'alta'];
const estados = ['abierta', 'en_proceso', 'resuelta', 'rechazada'];

async function cargarRol(req, res, next) {
  try {
    const { data, error } = await supabase
      .from('roles')
      .select('nombre_rol')
      .eq('id_rol', req.usuario.id_rol)
      .maybeSingle();
    if (error) throw error;
    req.usuario.rol = String(data?.nombre_rol || '').toLowerCase();
    if (!['admin', 'empleado', 'cliente'].includes(req.usuario.rol)) {
      return res.status(403).json({ error: 'No tienes permisos para esta operación' });
    }
    next();
  } catch (error) {
    res.status(500).json({ error: 'No se pudo validar el rol', detalle: error.message });
  }
}

router.use(cargarRol);

function responderError(res, error, mensaje) {
  const tablaFaltante = ['42P01', 'PGRST205'].includes(error?.code);
  res.status(tablaFaltante ? 503 : 500).json({
    error: tablaFaltante ? 'Falta crear la tabla solicitudes_empleado (ejecuta solicitudes_empleado_migration.sql en Supabase)' : mensaje,
    detalle: error.message
  });
}

router.get('/', async (req, res) => {
  try {
    let query = supabase.from('solicitudes_empleado').select('*').order('created_at', { ascending: false }).limit(200);
    if (req.usuario.rol === 'cliente') {
      query = query.eq('usuario_id', req.usuario.id);
    } else if (req.usuario.rol === 'empleado') {
      query = query.or(`rol_origen.eq.cliente,usuario_id.eq.${req.usuario.id}`);
    }
    const { data, error } = await query;
    if (error) throw error;

    const ids = [...new Set((data || []).map(item => item.usuario_id))];
    const { data: users } = ids.length
      ? await supabase.from('usuarios').select('id, nombre, email').in('id', ids)
      : { data: [] };
    const byId = new Map((users || []).map(user => [user.id, user]));
    res.json((data || []).map(item => ({
      ...item,
      autor: byId.get(item.usuario_id) || null,
      puede_responder: req.usuario.rol === 'admin' || (req.usuario.rol === 'empleado' && item.rol_origen === 'cliente')
    })));
  } catch (error) {
    responderError(res, error, 'Error al consultar solicitudes');
  }
});

router.post('/', async (req, res) => {
  try {
    if (req.usuario.rol === 'admin') {
      return res.status(403).json({ error: 'El administrador responde solicitudes, no las crea' });
    }
    const tipo = String(req.body.tipo || '').trim();
    const asunto = String(req.body.asunto || '').trim().slice(0, 180);
    const descripcion = String(req.body.descripcion || '').trim();
    const prioridad = String(req.body.prioridad || 'media').trim();
    const tramiteId = req.body.tramite_id ? Number(req.body.tramite_id) : null;
    if (!tipos.includes(tipo) || !prioridades.includes(prioridad) || !asunto || !descripcion) {
      return res.status(400).json({ error: 'Tipo, prioridad, asunto y descripción son obligatorios' });
    }
    if (tramiteId !== null && !Number.isInteger(tramiteId)) {
      return res.status(400).json({ error: 'Trámite inválido' });
    }

    const { data, error } = await supabase
      .from('solicitudes_empleado')
      .insert([{ usuario_id: req.usuario.id, rol_origen: req.usuario.rol, tipo, asunto, descripcion, prioridad, tramite_id: tramiteId }])
      .select()
      .single();
    if (error) throw error;
    await registrarAuditoria({ req, accion: 'crear_solicitud', recurso: 'solicitud', recursoId: data.id, detalles: { tipo, prioridad, origen: req.usuario.rol } });
    res.status(201).json(data);
  } catch (error) {
    responderError(res, error, 'Error al enviar la solicitud');
  }
});

router.put('/:id', async (req, res) => {
  try {
    if (req.usuario.rol === 'cliente') {
      return res.status(403).json({ error: 'No tienes permisos para responder solicitudes' });
    }
    const estado = String(req.body.estado || '').trim();
    const respuesta = String(req.body.respuesta || '').trim();
    if (!estados.includes(estado)) return res.status(400).json({ error: 'Estado inválido' });

    const { data: actual, error: lookupError } = await supabase
      .from('solicitudes_empleado')
      .select('id, rol_origen')
      .eq('id', req.params.id)
      .maybeSingle();
    if (lookupError) throw lookupError;
    if (!actual) return res.status(404).json({ error: 'Solicitud no encontrada' });
    if (req.usuario.rol === 'empleado' && actual.rol_origen !== 'cliente') {
      return res.status(403).json({ error: 'Solo el administrador responde solicitudes de empleados' });
    }

    const { data, error } = await supabase
      .from('solicitudes_empleado')
      .update({ estado, respuesta: respuesta || null, respondido_por: req.usuario.id, updated_at: new Date().toISOString() })
      .eq('id', req.params.id)
      .select()
      .single();
    if (error) throw error;
    await registrarAuditoria({ req, accion: 'responder_solicitud', recurso: 'solicitud', recursoId: data.id, detalles: { estado } });
    res.json(data);
  } catch (error) {
    responderError(res, error, 'Error al actualizar la solicitud');
  }
});

export default router;
