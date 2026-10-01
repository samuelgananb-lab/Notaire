import { Router } from 'express';
import { supabase } from '../database/supabase.js';
import { verificarToken } from '../middlewares/auth.middleware.js';

const router = Router();
router.use(verificarToken);

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
    const { data, error } = await supabase
      .from('metas')
      .update({ monto_actual: nuevoMontoActual })
      .eq('id', Number(metaId))
      .eq('usuario_id', req.usuario.id)
      .select('*')
      .single();

    if (error) throw error;
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
    const nombre = String(req.body.nombre || '').trim();
    const montoObjetivo = Number(req.body.monto_objetivo);
    const montoActual = Number(req.body.monto_actual);
    const { fecha_limite, icono } = req.body;

    if (!nombre || !Number.isFinite(montoObjetivo) || montoObjetivo <= 0 || !Number.isFinite(montoActual) || montoActual < 0) {
      return res.status(400).json({ error: 'Nombre y montos válidos son obligatorios' });
    }

    const { data, error } = await supabase
      .from('metas')
      .update({ nombre, monto_objetivo: montoObjetivo, monto_actual: montoActual, fecha_limite, icono })
      .eq('id', req.params.id)
      .eq('usuario_id', req.usuario.id)
      .select('*')
      .single();

    if (error) throw error;
    res.json({ mensaje: 'Meta actualizada correctamente', meta: data });
  } catch (error) {
    res.status(500).json({ error: 'Error al actualizar meta', detalle: error.message });
  }
});

router.put('/:id/abonar', async (req, res) => registrarAporte(req, res, req.params.id));

router.delete('/:id', async (req, res) => {
  try {
    const { error } = await supabase
      .from('metas')
      .delete()
      .eq('id', req.params.id)
      .eq('usuario_id', req.usuario.id);

    if (error) throw error;
    res.json({ mensaje: 'Meta eliminada correctamente' });
  } catch (error) {
    res.status(500).json({ error: 'Error al eliminar la meta', detalle: error.message });
  }
});

export default router;
