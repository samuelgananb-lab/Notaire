import { Router } from 'express';
import { supabase } from '../database/supabase.js';
import { verificarToken } from '../middlewares/auth.middleware.js';
import { sendNotificationEmail } from '../services/event-notifications.service.js';
import { formatCOP } from '../services/finance-alerts.service.js';

const router = Router();
router.use(verificarToken);

function avisarMeta(req, subject, detalle) {
  void sendNotificationEmail({
    to: req.usuario.email,
    subject,
    text: `Hola ${req.usuario.nombre || ''},\n\n${detalle}\n\nNotaire`
  });
}

async function calcularSaldoDisponible(usuarioId) {
  const [{ data: movimientos, error: errMov }, { data: metas, error: errMetas }] = await Promise.all([
    supabase.from('transacciones').select('tipo, monto').eq('usuario_id', usuarioId),
    supabase.from('metas').select('monto_actual').eq('usuario_id', usuarioId)
  ]);
  if (errMov) throw errMov;
  if (errMetas) throw errMetas;

  const total = (tipo) => (movimientos || []).filter(m => (m.tipo || m.tipo_registro) === tipo).reduce((s, m) => s + Number(m.monto || 0), 0);
  const ahorrado = (metas || []).reduce((s, m) => s + Number(m.monto_actual || 0), 0);
  return total('ingreso') - total('gasto') - ahorrado;
}

// Un abono no puede superar el saldo disponible; devuelve la respuesta 422 si lo excede.
function respuestaSaldoInsuficiente(res, saldo, solicitado) {
  const disponible = Math.max(0, saldo);
  return res.status(422).json({
    codigo: 'SALDO_INSUFICIENTE',
    saldoDisponible: disponible,
    montoSolicitado: solicitado,
    error: `Tu saldo disponible es ${formatCOP(disponible)} y quieres abonar ${formatCOP(solicitado)}. Registra primero un ingreso o abona hasta ${formatCOP(disponible)}.`
  });
}

router.get('/', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('metas')
      .select('*')
      .eq('usuario_id', req.usuario.id)
      .order('id', { ascending: false });

    if (error) throw error;
    res.json(data || []);
  } catch (error) {
    res.status(500).json({ error: 'Error al obtener metas', detalle: error.message });
  }
});

router.post('/', async (req, res) => {
  try {
    const { nombre, monto_objetivo, monto_actual, fecha_limite, icono } = req.body;
    const nombreMeta = String(nombre || '').trim();
    const montoObjetivo = Number(monto_objetivo);
    const montoActual = Number(monto_actual || 0);

    if (!nombreMeta || !Number.isFinite(montoObjetivo) || montoObjetivo <= 0 || !Number.isFinite(montoActual) || montoActual < 0) {
      return res.status(400).json({ error: 'Nombre y monto objetivo son obligatorios' });
    }

    const { data, error } = await supabase
      .from('metas')
      .insert([{
        usuario_id: req.usuario.id,
        nombre: nombreMeta,
        monto_objetivo: montoObjetivo,
        monto_actual: montoActual,
        fecha_limite,
        icono: icono || '🎯'
      }])
      .select('*')
      .single();

    if (error) throw error;
    avisarMeta(req, 'Meta creada', `Creaste la meta "${data.nombre}".\nObjetivo: ${formatCOP(data.monto_objetivo)}\nAhorro inicial: ${formatCOP(data.monto_actual)}\nFecha límite: ${data.fecha_limite || 'Sin fecha'}`);
    res.status(201).json({ mensaje: 'Meta creada', meta: data });
  } catch (error) {
    res.status(500).json({ error: 'Error al crear meta', detalle: error.message });
  }
});

async function registrarAporte(req, res, metaId) {
  try {
    const { monto } = req.body;
    const montoNumerico = Number(monto);
    if (!metaId || !Number.isInteger(Number(metaId)) || !Number.isFinite(montoNumerico) || montoNumerico <= 0) {
      return res.status(400).json({ error: 'ID de la meta y monto válido son obligatorios' });
    }

    const { data: meta, error: metaError } = await supabase
      .from('metas')
      .select('*')
      .eq('id', Number(metaId))
      .eq('usuario_id', req.usuario.id)
      .single();

    if (metaError || !meta) return res.status(404).json({ error: 'Meta no encontrada' });

    const saldo = await calcularSaldoDisponible(req.usuario.id);
    if (montoNumerico > saldo) return respuestaSaldoInsuficiente(res, saldo, montoNumerico);

    const { error: aporteError } = await supabase
      .from('aportes_meta')
      .insert([{
        meta_id: Number(metaId),
        usuario_id: req.usuario.id,
        monto: montoNumerico
      }]);

    if (aporteError) {
      console.error('Error al insertar aporte:', aporteError);
      return res.status(400).json({ error: 'Error al guardar el aporte', detalle: aporteError.message });
    }

    const nuevoMontoActual = Math.max(0, Number(meta.monto_actual || 0) + montoNumerico);
    const objetivo = Number(meta.monto_objetivo || 0);
    const { data, error } = await supabase
      .from('metas')
      .update({ monto_actual: nuevoMontoActual })
      .eq('id', Number(metaId))
      .eq('usuario_id', req.usuario.id)
      .select('*')
      .single();

    if (error) throw error;
    const completada = objetivo > 0 && Number(meta.monto_actual || 0) < objetivo && nuevoMontoActual >= objetivo;
    avisarMeta(req,
      completada ? '¡Meta alcanzada!' : 'Aporte registrado en tu meta',
      completada
        ? `¡Felicitaciones! Alcanzaste tu meta "${meta.nombre}" (${formatCOP(objetivo)}).`
        : `Abonaste ${formatCOP(montoNumerico)} a la meta "${meta.nombre}".\nLlevas ${formatCOP(nuevoMontoActual)} de ${formatCOP(objetivo)}.`);
    res.status(201).json({
      mensaje: 'Aporte realizado con éxito',
      nuevo_monto_actual: nuevoMontoActual,
      meta: data
    });
  } catch (error) {
    res.status(500).json({ error: 'Error al realizar el abono', detalle: error.message });
  }
}

router.get('/aportes', async (req, res) => {
  try {
    const { data: aportes, error } = await supabase
      .from('aportes_meta')
      .select('id, monto, fecha, meta_id')
      .eq('usuario_id', req.usuario.id)
      .order('fecha', { ascending: false });

    if (error) throw error;

    const metaIds = [...new Set((aportes || []).map(aporte => aporte.meta_id))];
    const { data: metas, error: metasError } = metaIds.length
      ? await supabase.from('metas').select('id, nombre').in('id', metaIds)
      : { data: [], error: null };
    if (metasError) throw metasError;
    const nombres = new Map((metas || []).map(meta => [String(meta.id), meta.nombre]));

    res.json((aportes || []).map(aporte => ({
      id: aporte.id,
      monto: aporte.monto,
      fecha: aporte.fecha,
      meta_id: aporte.meta_id,
      meta_nombre: nombres.get(String(aporte.meta_id)) || 'Meta de ahorro'
    })));
  } catch (error) {
    console.error('Error al obtener aportes:', error);
    res.status(500).json({ error: 'Error al consultar los aportes', detalle: error.message });
  }
});

router.post('/aportar', async (req, res) => {
  const { meta_id } = req.body;
  return registrarAporte(req, res, meta_id);
});

router.put('/:id', async (req, res) => {
  try {
    const metaId = Number(req.params.id);
    if (!Number.isInteger(metaId) || metaId <= 0) {
      return res.status(400).json({ error: 'ID de meta no válido' });
    }

    const nombre = String(req.body.nombre || '').trim();
    const montoObjetivo = Number(req.body.monto_objetivo);
    const montoActual = Number(req.body.monto_actual);
    const { fecha_limite, icono } = req.body;

    if (!nombre || nombre.length > 150 || !Number.isFinite(montoObjetivo) || montoObjetivo <= 0 || !Number.isFinite(montoActual) || montoActual < 0) {
      return res.status(400).json({ error: 'Nombre y montos válidos son obligatorios' });
    }

    const { data: existente, error: lookupError } = await supabase
      .from('metas')
      .select('id, nombre, monto_actual')
      .eq('id', metaId)
      .eq('usuario_id', req.usuario.id)
      .maybeSingle();
    if (lookupError) throw lookupError;
    if (!existente) return res.status(404).json({ error: 'Meta no encontrada para este usuario' });

    const incremento = montoActual - Number(existente.monto_actual || 0);
    if (incremento > 0) {
      const saldo = await calcularSaldoDisponible(req.usuario.id);
      if (incremento > saldo) return respuestaSaldoInsuficiente(res, saldo, incremento);
    }

    const { data, error } = await supabase
      .from('metas')
      .update({
        nombre,
        monto_objetivo: montoObjetivo,
        monto_actual: montoActual,
        fecha_limite: fecha_limite || null,
        ...(icono !== undefined ? { icono } : {})
      })
      .eq('id', metaId)
      .eq('usuario_id', req.usuario.id)
      .select('*')
      .maybeSingle();

    if (error) throw error;
    if (!data) return res.status(404).json({ error: 'La meta ya no existe o no pertenece a este usuario' });
    const completada = Number(existente.monto_actual || 0) < montoObjetivo && montoActual >= montoObjetivo;
    avisarMeta(req,
      completada ? '¡Meta alcanzada!' : 'Meta actualizada',
      completada
        ? `¡Felicitaciones! Alcanzaste tu meta "${data.nombre}" (${formatCOP(montoObjetivo)}).`
        : `Actualizaste la meta "${data.nombre}".\nObjetivo: ${formatCOP(data.monto_objetivo)}\nAhorrado: ${formatCOP(data.monto_actual)}\nFecha límite: ${data.fecha_limite || 'Sin fecha'}`);
    res.json({ mensaje: 'Meta actualizada correctamente', meta: data });
  } catch (error) {
    res.status(500).json({ error: 'Error al actualizar meta', detalle: error.message });
  }
});

router.put('/:id/abonar', async (req, res) => registrarAporte(req, res, req.params.id));

router.delete('/:id', async (req, res) => {
  try {
    const metaId = Number(req.params.id);
    if (!Number.isInteger(metaId) || metaId <= 0) {
      return res.status(400).json({ error: 'ID de meta no válido' });
    }

    const { data, error } = await supabase
      .from('metas')
      .delete()
      .eq('id', metaId)
      .eq('usuario_id', req.usuario.id)
      .select('id, nombre, monto_actual')
      .maybeSingle();

    if (error) throw error;
    if (!data) return res.status(404).json({ error: 'Meta no encontrada para este usuario' });
    avisarMeta(req, 'Meta eliminada', `Eliminaste la meta "${data.nombre}".\nAhorro que tenía asignado: ${formatCOP(data.monto_actual)}`);
    res.json({ mensaje: 'Meta eliminada correctamente' });
  } catch (error) {
    res.status(500).json({ error: 'Error al eliminar la meta', detalle: error.message });
  }
});

export default router;
