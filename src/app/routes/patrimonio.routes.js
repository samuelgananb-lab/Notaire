import { Router } from 'express';
import { supabase } from '../database/supabase.js';
import { verificarToken } from '../middlewares/auth.middleware.js';

const router = Router();
router.get('/', verificarToken, async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('patrimonio')
      .select('*')
      .eq('usuario_id', req.usuario.id);

    if (error) throw error;

    const activos = (data || []).filter(item => String(item.tipo).toLowerCase().startsWith('activo'));
    const pasivos = (data || []).filter(item => String(item.tipo).toLowerCase().startsWith('pasivo'));
    const totalActivos = activos.reduce((sum, item) => sum + Number(item.monto || 0), 0);
    const totalPasivos = pasivos.reduce((sum, item) => sum + Number(item.monto || 0), 0);

    res.json({ patrimonioNeto: totalActivos - totalPasivos, totalActivos, totalPasivos, activos, pasivos });
  } catch (error) {
    res.status(500).json({ error: 'Error al consultar patrimonio', detalle: error.message });
  }
});

router.post('/', verificarToken, async (req, res) => {
  try {
    const { tipo, categoria, monto } = req.body;
    if (!tipo || !categoria || monto === undefined) {
      return res.status(400).json({ error: 'Tipo, categoría y monto son requeridos' });
    }

    const { data, error } = await supabase
      .from('patrimonio')
      .insert([{ usuario_id: req.usuario.id, tipo: String(tipo).toLowerCase(), categoria, monto }])
      .select('*')
      .single();

    if (error) throw error;
    res.status(201).json({ mensaje: 'Registro de patrimonio guardado', patrimonio: data });
  } catch (error) {
    res.status(500).json({ error: 'Error al registrar patrimonio', detalle: error.message });
  }
});

export default router;
