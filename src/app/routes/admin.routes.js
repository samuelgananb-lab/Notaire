import { Router } from 'express';
import { supabase } from '../database/supabase.js';
import { verificarToken } from '../middlewares/auth.middleware.js';
import { registrarAuditoria } from '../services/audit.service.js';
import { sendNotificationEmail } from '../services/event-notifications.service.js';

const router = Router();
router.use(verificarToken);

function verificarRoles(rolesPermitidos) {
  return async (req, res, next) => {
  try {
    const { data: role, error } = await supabase
      .from('roles')
      .select('nombre_rol')
      .eq('id_rol', req.usuario.id_rol)
      .maybeSingle();

    if (error) throw error;
    const roleName = String(role?.nombre_rol || '').toLowerCase();
    if (!rolesPermitidos.includes(roleName)) {
      return res.status(403).json({ error: 'No tienes permisos para esta operación' });
    }

    req.usuario.rol = roleName;

    next();
  } catch (error) {
    res.status(500).json({ error: 'No se pudo validar el rol', detalle: error.message });
  }
  };
}

const verificarAdmin = verificarRoles(['admin']);
const verificarOperacion = verificarRoles(['admin', 'empleado']);

router.put('/metas/:id', verificarOperacion, async (req, res) => {
  try {
    const metaId = Number(req.params.id);
    if (!Number.isInteger(metaId) || metaId <= 0) {
      return res.status(400).json({ error: 'ID de meta no válido' });
    }

    const nombre = String(req.body.nombre || '').trim();
    const montoObjetivo = Number(req.body.monto_objetivo);
    const montoActual = Number(req.body.monto_actual);
    if (!nombre || nombre.length > 150 || !Number.isFinite(montoObjetivo) || montoObjetivo <= 0 || !Number.isFinite(montoActual) || montoActual < 0) {
      return res.status(400).json({ error: 'Nombre y montos válidos son obligatorios' });
    }

    let lookup = supabase.from('metas').select('id, usuario_id').eq('id', metaId);
    if (req.usuario.rol === 'empleado') lookup = lookup.eq('usuario_id', req.usuario.id);
    const { data: existente, error: lookupError } = await lookup.maybeSingle();
    if (lookupError) throw lookupError;
    if (!existente) return res.status(404).json({ error: 'Meta no encontrada o no tienes permiso para modificarla' });

    const { data, error } = await supabase
      .from('metas')
      .update({
        nombre,
        monto_objetivo: montoObjetivo,
        monto_actual: montoActual,
        fecha_limite: req.body.fecha_limite || null,
        ...(req.body.icono !== undefined ? { icono: req.body.icono } : {})
      })
      .eq('id', metaId)
      .select('*')
      .maybeSingle();
    if (error) throw error;
    if (!data) return res.status(404).json({ error: 'La meta ya no existe' });

    await registrarAuditoria({
      req,
      accion: 'actualizar_meta',
      recurso: 'meta',
      recursoId: metaId,
      detalles: { nombre, monto_objetivo: montoObjetivo, monto_actual: montoActual }
    });
    res.json({ mensaje: 'Meta actualizada correctamente', meta: data });
  } catch (error) {
    res.status(500).json({ error: 'Error al actualizar meta', detalle: error.message });
  }
});

router.delete('/metas/:id', verificarOperacion, async (req, res) => {
  try {
    const metaId = Number(req.params.id);
    if (!Number.isInteger(metaId) || metaId <= 0) {
      return res.status(400).json({ error: 'ID de meta no válido' });
    }

    let deletion = supabase.from('metas').delete().eq('id', metaId);
    if (req.usuario.rol === 'empleado') deletion = deletion.eq('usuario_id', req.usuario.id);
    const { data, error } = await deletion.select('id, usuario_id').maybeSingle();
    if (error) throw error;
    if (!data) return res.status(404).json({ error: 'Meta no encontrada o no tienes permiso para eliminarla' });

    await registrarAuditoria({
      req,
      accion: 'eliminar_meta',
      recurso: 'meta',
      recursoId: metaId
    });
    res.json({ mensaje: 'Meta eliminada correctamente' });
  } catch (error) {
    res.status(500).json({ error: 'Error al eliminar meta', detalle: error.message });
  }
});

async function consultarFilasSeguro(query, etiqueta) {
  const { data, error } = await query;
  if (error) {
    console.warn(`No se pudieron consultar ${etiqueta}:`, error.message);
    return [];
  }
  return data || [];
}

router.get('/audit', verificarAdmin, async (req, res) => {
  try {
    const limit = Math.min(Math.max(Number(req.query.limit) || 50, 1), 200);
    let query = supabase
      .from('auditoria_acciones')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit);
    if (req.query.accion) query = query.eq('accion', String(req.query.accion));

    const { data: auditRows, error } = await query;
    if (error) throw error;

    const actorIds = [...new Set((auditRows || []).map(row => row.actor_id).filter(Boolean))];
    const { data: actors, error: actorsError } = actorIds.length
      ? await supabase.from('usuarios').select('id, nombre, email').in('id', actorIds)
      : { data: [], error: null };
    if (actorsError) throw actorsError;
    const actorMap = new Map((actors || []).map(actor => [String(actor.id), actor]));

    res.json((auditRows || []).map(row => ({
      ...row,
      actor: actorMap.get(String(row.actor_id)) || null
    })));
  } catch (error) {
    res.status(500).json({ error: 'Error al consultar auditoría', detalle: error.message });
  }
});

router.get('/notifications', verificarOperacion, async (_req, res) => {
  try {
    const [auditRows, reminders, events, tramites] = await Promise.all([
      consultarFilasSeguro(
        supabase.from('auditoria_acciones').select('id, actor_id, accion, recurso, recurso_id, detalles, created_at').order('created_at', { ascending: false }).limit(20),
        'auditoría'
      ),
      consultarFilasSeguro(
        supabase.from('recordatorios').select('id, usuario_id, titulo, monto, fecha_vencimiento, estado').eq('estado', 'pendiente').order('fecha_vencimiento', { ascending: true }).limit(20),
        'recordatorios'
      ),
      consultarFilasSeguro(
        supabase.from('eventos_calendario').select('id, usuario_id, titulo, fecha, hora, fecha_hora, tipo').eq('estado', 'pendiente').order('fecha_hora', { ascending: true }).limit(20),
        'eventos'
      ),
      consultarFilasSeguro(
        supabase.from('tramites_notariales').select('id, usuario_id, titulo, estado, fecha_limite').in('estado', ['pendiente', 'en_revision']).order('fecha_limite', { ascending: true }).limit(20),
        'trámites'
      )
    ]);

    const actorIds = [...new Set([
      ...auditRows.map(row => row.actor_id),
      ...reminders.map(row => row.usuario_id),
      ...events.map(row => row.usuario_id),
      ...tramites.map(row => row.usuario_id)
    ].filter(Boolean))];
    const users = actorIds.length
      ? await consultarFilasSeguro(supabase.from('usuarios').select('id, nombre, email').in('id', actorIds), 'usuarios de notificaciones')
      : [];
    const names = new Map(users.map(user => [String(user.id), user.nombre || user.email || 'Usuario']));

    const items = [
      ...tramites.map(row => ({
        id: `tramite-${row.id}`,
        type: 'tramite',
        title: `Trámite ${row.estado === 'pendiente' ? 'pendiente' : 'en revisión'}`,
        message: row.titulo,
        detail: row.fecha_limite ? `Fecha límite: ${row.fecha_limite}` : 'Sin fecha límite',
        date: row.fecha_limite || new Date().toISOString(),
        user: names.get(String(row.usuario_id)) || 'Sin cliente',
        resourceId: row.id
      })),
      ...reminders.map(row => ({
        id: `recordatorio-${row.id}`,
        type: 'recordatorio',
        title: 'Recordatorio pendiente',
        message: row.titulo,
        detail: row.fecha_vencimiento ? `Vence: ${row.fecha_vencimiento}` : 'Sin fecha',
        date: row.fecha_vencimiento || new Date().toISOString(),
        user: names.get(String(row.usuario_id)) || 'Sin usuario',
        resourceId: row.id
      })),
      ...events.map(row => ({
        id: `evento-${row.id}`,
        type: 'evento',
        title: 'Evento próximo',
        message: row.titulo,
        detail: row.fecha_hora || `${row.fecha || ''} ${row.hora || ''}`,
        date: row.fecha_hora || row.fecha || new Date().toISOString(),
        user: names.get(String(row.usuario_id)) || 'Sin usuario',
        resourceId: row.id
      })),
      ...auditRows.map(row => ({
        id: `audit-${row.id}`,
        type: 'auditoria',
        title: 'Actividad administrativa',
        message: `${row.accion} en ${row.recurso}`,
        detail: row.recurso_id ? `Registro #${row.recurso_id}` : JSON.stringify(row.detalles || {}),
        date: row.created_at,
        user: names.get(String(row.actor_id)) || 'Usuario',
        resourceId: row.recurso_id
      }))
    ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    res.json({ items: items.slice(0, 80), unread: items.length });
  } catch (error) {
    res.status(500).json({ error: 'Error al consultar notificaciones operativas', detalle: error.message });
  }
});

router.get('/reports', verificarAdmin, async (req, res) => {
  try {
    const from = String(req.query.from || '').trim();
    const to = String(req.query.to || '').trim();
    let transactionQuery = supabase.from('transacciones').select('tipo, monto, categoria, fecha');
    if (from) transactionQuery = transactionQuery.gte('fecha', from);
    if (to) transactionQuery = transactionQuery.lte('fecha', to);

    const [transactions, tramites] = await Promise.all([
      consultarFilasSeguro(transactionQuery, 'transacciones para reportes'),
      consultarFilasSeguro(supabase.from('tramites_notariales').select('estado, tipo, created_at, fecha_limite'), 'trámites para reportes')
    ]);

    const ingresos = transactions.filter(item => item.tipo === 'ingreso');
    const gastos = transactions.filter(item => item.tipo === 'gasto');
    const sum = items => items.reduce((total, item) => total + Number(item.monto || 0), 0);
    const groupBy = (items, key) => [...items.reduce((groups, item) => {
      const label = item[key] || 'Sin categoría';
      groups.set(label, (groups.get(label) || 0) + Number(item.monto || 0));
      return groups;
    }, new Map())].map(([label, total]) => ({ label, total })).sort((a, b) => b.total - a.total);
    const groupCount = (items, key) => [...items.reduce((groups, item) => {
      const label = item[key] || 'Sin estado';
      groups.set(label, (groups.get(label) || 0) + 1);
      return groups;
    }, new Map())].map(([label, total]) => ({ label, total })).sort((a, b) => b.total - a.total);
    const monthly = [...transactions.reduce((groups, item) => {
      const month = String(item.fecha || '').slice(0, 7) || 'Sin fecha';
      const current = groups.get(month) || { mes: month, ingresos: 0, gastos: 0 };
      current[item.tipo === 'ingreso' ? 'ingresos' : 'gastos'] += Number(item.monto || 0);
      groups.set(month, current);
      return groups;
    }, new Map())].map(([, value]) => value).sort((a, b) => a.mes.localeCompare(b.mes));

    res.json({
      filters: { from: from || null, to: to || null },
      kpis: {
        ingresos: sum(ingresos),
        gastos: sum(gastos),
        balance: sum(ingresos) - sum(gastos),
        tramites: tramites.length
      },
      gastosPorCategoria: groupBy(gastos, 'categoria'),
      ingresosPorCategoria: groupBy(ingresos, 'categoria'),
      tramitesPorEstado: groupCount(tramites, 'estado'),
      mensual: monthly
    });
  } catch (error) {
    res.status(500).json({ error: 'Error al generar reportes', detalle: error.message });
  }
});

router.get('/users', verificarOperacion, async (_req, res) => {
  try {
    const [{ data: usuarios, error: usersError }, { data: roles, error: rolesError }] = await Promise.all([
      supabase.from('usuarios').select('id, nombre, email, telefono, id_rol').order('nombre', { ascending: true }),
      supabase.from('roles').select('id_rol, nombre_rol')
    ]);

    if (usersError) throw usersError;
    if (rolesError) throw rolesError;

    const roleNames = new Map((roles || []).map(role => [String(role.id_rol), String(role.nombre_rol || '').toLowerCase()]));
    res.json((usuarios || []).map(user => ({
      ...user,
      rol: roleNames.get(String(user.id_rol)) || 'sin rol'
    })));
  } catch (error) {
    res.status(500).json({ error: 'Error al consultar usuarios', detalle: error.message });
  }
});

router.put('/users/:id/role', verificarAdmin, async (req, res) => {
  try {
    if (String(req.params.id) === String(req.usuario.id)) {
      return res.status(400).json({ error: 'No puedes cambiar tu propio rol' });
    }

    const roleName = String(req.body.rol || '').trim().toLowerCase();
    if (!['admin', 'cliente', 'empleado'].includes(roleName)) {
      return res.status(400).json({ error: 'Rol no válido' });
    }

    const { data: role, error: roleError } = await supabase
      .from('roles')
      .select('id_rol, nombre_rol')
      .ilike('nombre_rol', roleName)
      .maybeSingle();
    if (roleError) throw roleError;
    if (!role) return res.status(404).json({ error: 'Rol no encontrado' });

    const { data, error } = await supabase
      .from('usuarios')
      .update({ id_rol: role.id_rol })
      .eq('id', req.params.id)
      .select('id, nombre, email, telefono, id_rol')
      .single();
    if (error) throw error;

    void sendNotificationEmail({
      to: data.email,
      subject: 'Tu rol de Notaire fue actualizado',
      text: `Hola ${data.nombre || ''},\n\nEl rol de tu cuenta Notaire se actualizó a "${role.nombre_rol}". Si no esperabas este cambio, contacta al administrador del sistema.`
    });
    await registrarAuditoria({
      req,
      accion: 'cambiar_rol',
      recurso: 'usuario',
      recursoId: req.params.id,
      detalles: { rol_anterior: req.body.rol_anterior || null, rol_nuevo: role.nombre_rol }
    });

    res.json({ mensaje: 'Rol actualizado', usuario: { ...data, rol: role.nombre_rol } });
  } catch (error) {
    res.status(500).json({ error: 'Error al actualizar el rol', detalle: error.message });
  }
});

const estadosTramite = ['recibido', 'en_revision', 'pendiente', 'aprobado', 'finalizado', 'rechazado'];

async function enrichTramites(tramites) {
  const userIds = [...new Set((tramites || []).flatMap(tramite => [tramite.usuario_id, tramite.responsable_id]).filter(Boolean))];
  if (!userIds.length) return tramites || [];

  const { data: usuarios, error } = await supabase
    .from('usuarios')
    .select('id, nombre, email')
    .in('id', userIds);
  if (error) throw error;

  const names = new Map((usuarios || []).map(user => [String(user.id), user]));
  return (tramites || []).map(tramite => ({
    ...tramite,
    cliente: names.get(String(tramite.usuario_id)) || null,
    responsable: names.get(String(tramite.responsable_id)) || null
  }));
}

async function notificarParticipantesTramite(tramite, accion) {
  try {
    const userIds = [...new Set([tramite.usuario_id, tramite.responsable_id].filter(Boolean))];
    if (!userIds.length) return;

    const { data: usuarios, error } = await supabase
      .from('usuarios')
      .select('id, nombre, email')
      .in('id', userIds);
    if (error) throw error;

    await Promise.all((usuarios || []).map(usuario => sendNotificationEmail({
      to: usuario.email,
      subject: `Trámite ${accion}: ${tramite.titulo}`,
      text: `Hola ${usuario.nombre || ''},\n\nEl trámite "${tramite.titulo}" (${tramite.tipo}) fue ${accion}.\nEstado: ${tramite.estado}\nFecha límite: ${tramite.fecha_limite || 'Sin fecha definida'}\n\nIngresa a Notaire para ver los detalles.`
    })));
  } catch (error) {
    console.error('Error notificando participantes del trámite:', error.message);
  }
}

router.get('/tramites', verificarOperacion, async (_req, res) => {
  try {
    const { data, error } = await supabase
      .from('tramites_notariales')
      .select('*')
      .order('fecha_limite', { ascending: true });
    if (error) throw error;
    res.json(await enrichTramites(data));
  } catch (error) {
    res.status(500).json({ error: 'Error al consultar trámites', detalle: error.message });
  }
});

router.post('/tramites', verificarOperacion, async (req, res) => {
  try {
    const titulo = String(req.body.titulo || '').trim();
    const tipo = String(req.body.tipo || '').trim();
    const estado = String(req.body.estado || 'recibido').trim().toLowerCase();
    if (!titulo || !tipo || !estadosTramite.includes(estado)) {
      return res.status(400).json({ error: 'Título, tipo y estado válido son obligatorios' });
    }

    const { data, error } = await supabase
      .from('tramites_notariales')
      .insert([{
        titulo,
        tipo,
        estado,
        usuario_id: req.body.usuario_id || null,
        responsable_id: req.body.responsable_id || null,
        fecha_limite: req.body.fecha_limite || null,
        descripcion: String(req.body.descripcion || '').trim() || null
      }])
      .select('*')
      .single();
    if (error) throw error;
    void notificarParticipantesTramite(data, 'creado');
    await registrarAuditoria({
      req,
      accion: 'crear_tramite',
      recurso: 'tramite',
      recursoId: data.id,
      detalles: { titulo: data.titulo, tipo: data.tipo, estado: data.estado }
    });
    res.status(201).json({ mensaje: 'Trámite creado', tramite: (await enrichTramites([data]))[0] });
  } catch (error) {
    res.status(500).json({ error: 'Error al crear trámite', detalle: error.message });
  }
});

router.put('/tramites/:id', verificarOperacion, async (req, res) => {
  try {
    const updates = {};
    for (const field of ['titulo', 'tipo', 'usuario_id', 'responsable_id', 'fecha_limite', 'descripcion']) {
      if (req.body[field] !== undefined) updates[field] = req.body[field] || null;
    }
    if (req.body.estado !== undefined) {
      const estado = String(req.body.estado).trim().toLowerCase();
      if (!estadosTramite.includes(estado)) return res.status(400).json({ error: 'Estado no válido' });
      updates.estado = estado;
    }
    updates.updated_at = new Date().toISOString();

    const { data, error } = await supabase
      .from('tramites_notariales')
      .update(updates)
      .eq('id', req.params.id)
      .select('*')
      .single();
    if (error) throw error;
    void notificarParticipantesTramite(data, 'actualizado');
    await registrarAuditoria({
      req,
      accion: 'actualizar_tramite',
      recurso: 'tramite',
      recursoId: req.params.id,
      detalles: updates
    });
    res.json({ mensaje: 'Trámite actualizado', tramite: (await enrichTramites([data]))[0] });
  } catch (error) {
    res.status(500).json({ error: 'Error al actualizar trámite', detalle: error.message });
  }
});

router.delete('/tramites/:id', verificarOperacion, async (req, res) => {
  try {
    const { data: tramite, error: lookupError } = await supabase
      .from('tramites_notariales')
      .select('*')
      .eq('id', req.params.id)
      .maybeSingle();
    if (lookupError) throw lookupError;
    if (!tramite) return res.status(404).json({ error: 'Trámite no encontrado' });

    const { error } = await supabase.from('tramites_notariales').delete().eq('id', req.params.id);
    if (error) throw error;
    void notificarParticipantesTramite(tramite, 'eliminado');
    await registrarAuditoria({
      req,
      accion: 'eliminar_tramite',
      recurso: 'tramite',
      recursoId: req.params.id
    });
    res.json({ mensaje: 'Trámite eliminado' });
  } catch (error) {
    res.status(500).json({ error: 'Error al eliminar trámite', detalle: error.message });
  }
});

router.get('/summary', verificarOperacion, async (req, res) => {
  try {
    const employeeSafe = req.usuario.rol === 'empleado';
    const usersQuery = supabase.from('usuarios').select('id, nombre, email, id_rol');
    const transactionsQuery = supabase.from('transacciones').select('id, usuario_id, tipo, monto, categoria, descripcion, fecha').order('fecha', { ascending: false }).limit(1000);
    const goalsQuery = supabase.from('metas').select('id, usuario_id, nombre, monto_actual, monto_objetivo, fecha_limite').order('id', { ascending: false }).limit(200);
    const contributionsQuery = supabase.from('aportes_meta').select('id, usuario_id, meta_id, monto, fecha').order('fecha', { ascending: false }).limit(100);
    const assetsQuery = supabase.from('patrimonio').select('id, usuario_id, tipo, categoria, monto').limit(300);

    if (employeeSafe) {
      usersQuery.eq('id', req.usuario.id);
      transactionsQuery.eq('usuario_id', req.usuario.id);
      goalsQuery.eq('usuario_id', req.usuario.id);
      contributionsQuery.eq('usuario_id', req.usuario.id);
      assetsQuery.eq('usuario_id', req.usuario.id);
    }

    const [usuarios, transacciones, metas, roles, aportes, patrimonio] = await Promise.all([
      consultarFilasSeguro(usersQuery, 'usuarios'),
      consultarFilasSeguro(transactionsQuery, 'transacciones'),
      consultarFilasSeguro(goalsQuery, 'metas'),
      consultarFilasSeguro(supabase.from('roles').select('id_rol, nombre_rol'), 'roles'),
      consultarFilasSeguro(contributionsQuery, 'aportes'),
      consultarFilasSeguro(assetsQuery, 'patrimonio')
    ]);

    const roleNames = new Map((roles || []).map(role => [String(role.id_rol), String(role.nombre_rol || '').toLowerCase()]));
    const userNames = new Map((usuarios || []).map(user => [String(user.id), user.nombre || user.email || 'Usuario']));
    const goalNames = new Map((metas || []).map(goal => [String(goal.id), goal.nombre || 'Meta']));
    const currentMonth = new Date().toISOString().slice(0, 7);
    const monthTransactions = (transacciones || []).filter(transaction => String(transaction.fecha || '').slice(0, 7) === currentMonth);
    const sumByType = type => monthTransactions
      .filter(transaction => transaction.tipo === type)
      .reduce((total, transaction) => total + Number(transaction.monto || 0), 0);

    const ingresosMes = sumByType('ingreso');
    const gastosMes = sumByType('gasto');
    const ingresosAcumulados = (transacciones || [])
      .filter(transaction => transaction.tipo === 'ingreso')
      .reduce((total, transaction) => total + Number(transaction.monto || 0), 0);
    const gastosAcumulados = (transacciones || [])
      .filter(transaction => transaction.tipo === 'gasto')
      .reduce((total, transaction) => total + Number(transaction.monto || 0), 0);
    const totalAhorrado = (metas || []).reduce((total, meta) => total + Number(meta.monto_actual || 0), 0);
    const metasActivas = (metas || []).filter(meta => Number(meta.monto_actual || 0) < Number(meta.monto_objetivo || 0)).length;
    const clientes = (usuarios || []).filter(user => roleNames.get(String(user.id_rol)) === 'cliente').length;
    const activos = (patrimonio || []).filter(item => String(item.tipo || '').toLowerCase().startsWith('activo'));
    const pasivos = (patrimonio || []).filter(item => String(item.tipo || '').toLowerCase().startsWith('pasivo'));
    const totalActivos = activos.reduce((total, item) => total + Number(item.monto || 0), 0);
    const totalPasivos = pasivos.reduce((total, item) => total + Number(item.monto || 0), 0);
    const patrimonioCalculado = patrimonio.length
      ? totalActivos - totalPasivos
      : ingresosAcumulados - gastosAcumulados;
    res.json({
      employeeScope: employeeSafe,
      usuariosTotal: employeeSafe ? null : (usuarios || []).length,
      clientesTotal: employeeSafe ? null : clientes,
      ingresosMes,
      gastosMes,
      totalAhorrado,
      patrimonio: patrimonioCalculado,
      totalActivos,
      totalPasivos,
      activos,
      pasivos,
      metasActivas,
      transactions: transacciones || [],
      goals: metas || [],
      recentContributions: (aportes || []).slice(0, 6).map(aporte => ({
        ...aporte,
        usuario_nombre: userNames.get(String(aporte.usuario_id)) || 'Usuario',
        meta_nombre: goalNames.get(String(aporte.meta_id)) || 'Meta'
      })),
      recentTransactions: (transacciones || []).slice(0, 6).map(transaction => ({
        ...transaction,
        usuario_nombre: userNames.get(String(transaction.usuario_id)) || 'Usuario'
      })),
      topGoals: (metas || []).slice(0, 5).map(meta => ({
        ...meta,
        porcentaje: Number(meta.monto_objetivo) > 0
          ? Math.min(100, Math.round((Number(meta.monto_actual || 0) / Number(meta.monto_objetivo)) * 100))
          : 0
      }))
    });
  } catch (error) {
    res.status(500).json({ error: 'Error al consultar el resumen administrativo', detalle: error.message });
  }
});

export default router;
