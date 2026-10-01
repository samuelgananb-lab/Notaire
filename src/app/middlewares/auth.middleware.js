import jwt from 'jsonwebtoken';
import { supabase, supabaseAuth } from '../database/supabase.js';

export const JWT_SECRET = process.env.JWT_SECRET || 'secreto_notaire';

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

    const verificado = jwt.verify(token, JWT_SECRET);
    const id = verificado.id || verificado.usuario_id || verificado.sub;

    if (!id) {
      return res.status(403).json({ error: 'Token sin identificador de usuario' });
    }

    req.usuario = {
      ...verificado,
      id,
      email: verificado.email,
      id_rol: verificado.id_rol
    };
    next();
  } catch (error) {
    console.error('Error al verificar token:', error.message);
    return res.status(403).json({ error: 'Token inválido o expirado' });
  }
};
