import { supabase } from '../database/supabase.js';

export async function registrarAuditoria({ req, accion, recurso, recursoId = null, detalles = {} }) {
  try {
    const { error } = await supabase.from('auditoria_acciones').insert([{
      actor_id: req.usuario?.id || null,
      accion,
      recurso,
      recurso_id: recursoId === null ? null : String(recursoId),
      detalles,
      ip_address: req.ip || null,
      user_agent: req.get('user-agent') || null
    }]);

    if (error) console.error('Error al registrar auditoría:', error.message);
  } catch (error) {
    console.error('Error inesperado de auditoría:', error.message);
  }
}
