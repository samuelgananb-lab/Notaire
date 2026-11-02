import jwt from 'jsonwebtoken';
import crypto from 'node:crypto';
import { supabase, supabaseAuth } from '../database/supabase.js';

// Sin JWT_SECRET se usa un secreto aleatorio por proceso (nunca uno público)
if (!process.env.JWT_SECRET) {
  console.warn('[seguridad] JWT_SECRET no definido: se usa un secreto temporal; defínelo en .env');
}
export const JWT_SECRET = process.env.JWT_SECRET || crypto.randomBytes(48).toString('hex');

export const bloquearEmpleado = async (req, res, next) => {
  try {
    const { data: role, error } = await supabase
      .from('roles')
      .select('nombre_rol')
      .eq('id_rol', req.usuario.id_rol)
      .maybeSingle();
    if (error) throw error;
    if (String(role?.nombre_rol || '').toLowerCase() === 'empleado') {
      return res.status(403).json({ error: 'El rol empleado no tiene acceso a información financiera' });
    }
    next();
  } catch (error) {
    res.status(500).json({ error: 'No se pudo validar el rol', detalle: error.message });
  }
};

export const verificarToken = async (req, res, next) => {
  const authHeader = req.headers.authorization;
  const token = authHeader?.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Acceso denegado, token no proporcionado' });
  }

  try {
    const { data: authData } = await supabaseAuth.auth.getUser(token);
    if (authData.user) {
      const { data: usuario } = await supabase
        .from('usuarios')
        .select('id, auth_id, email, id_rol, nombre')
        .or(`auth_id.eq.${authData.user.id},email.eq.${authData.user.email}`)
        .maybeSingle();

      if (usuario) {
        req.usuario = { id: usuario.id, auth_id: usuario.auth_id || authData.user.id, email: usuario.email, id_rol: usuario.id_rol, nombre: usuario.nombre };
        return next();
      }
    }

    const verificado = jwt.verify(token, JWT_SECRET, { algorithms: ['HS256'] });
    const id = verificado.id || verificado.usuario_id || verificado.sub;

    if (!id) {
      return res.status(403).json({ error: 'Token sin identificador de usuario' });
    }

    // El rol nunca se toma del token: se resuelve desde la base de datos
    const { data: usuario } = await supabase
      .from('usuarios')
      .select('id, auth_id, email, id_rol, nombre')
      .eq('id', id)
      .maybeSingle();

    if (!usuario) {
      return res.status(403).json({ error: 'Token inválido o expirado' });
    }

    req.usuario = { id: usuario.id, auth_id: usuario.auth_id, email: usuario.email, id_rol: usuario.id_rol, nombre: usuario.nombre };
    next();
  } catch (error) {
    console.error('Error al verificar token:', error.message);
    return res.status(403).json({ error: 'Token inválido o expirado' });
  }
};
