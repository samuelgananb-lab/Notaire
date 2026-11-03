import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { supabase, supabaseAuth } from '../database/supabase.js';
import { JWT_SECRET, verificarToken } from '../middlewares/auth.middleware.js';
import { loginRateLimit } from '../middlewares/login-rate-limit.middleware.js';
import { registrarAuditoria } from '../services/audit.service.js';
import { getPrefs, savePrefs } from '../services/notification-prefs.service.js';

const router = Router();
const ID_ROL_CLIENTE = '11111111-1111-1111-1111-111111111111';
const LOCAL_SESSION_MAX_AGE_SECONDS = 30 * 24 * 60 * 60;

function auditarResultadoLogin(req, res) {
  res.once('finish', () => {
    if (![200, 401].includes(res.statusCode)) return;
    registrarAuditoria({
      req,
      accion: res.statusCode === 200 ? 'login_exitoso' : 'login_fallido',
      recurso: 'autenticacion',
      detalles: { status: res.statusCode }
    }).catch(() => console.error('No se pudo registrar la auditoría de autenticación.'));
  });
}

async function obtenerNombreRol(idRol) {
  if (!idRol) return null;

  const { data, error } = await supabase
    .from('roles')
    .select('nombre_rol')
    .eq('id_rol', idRol)
    .maybeSingle();

  if (error) throw error;
  return data?.nombre_rol ? String(data.nombre_rol).trim().toLowerCase() : null;
}

function crearSesionLocal(usuario) {
  const token = jwt.sign(
    { id: usuario.id, email: usuario.email, id_rol: usuario.id_rol },
    JWT_SECRET,
    { expiresIn: '24h' }
  );
  const refresh_token = jwt.sign(
    { id: usuario.id, token_type: 'refresh' },
    JWT_SECRET,
    { expiresIn: '30d' }
  );
  const payload = jwt.decode(token);

  return { token, refresh_token, expires_at: payload.exp };
}

// POST: Registrar nuevo usuario
router.post('/registro', async (req, res) => {
  try {
    const nombre = String(req.body.nombre || '').trim();
    const email = String(req.body.email || '').trim().toLowerCase();
    const password = String(req.body.password || '');
    const telefono = String(req.body.telefono || '').trim();

    if (!nombre || !email || !password) {
      return res.status(400).json({ error: 'Nombre, email y contraseña son obligatorios' });
    }

    const { data: usuarioExistente, error: lookupError } = await supabase
      .from('usuarios')
      .select('id')
      .eq('email', email)
      .maybeSingle();

    if (lookupError) throw lookupError;
    if (usuarioExistente) {
      return res.status(400).json({ error: 'El correo electrónico ya se encuentra registrado' });
    }

    const { data: authData, error: authError } = await supabaseAuth.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { nombre, telefono }
    });

    if (authError || !authData.user) {
      return res.status(400).json({ error: 'No se pudo crear la cuenta de autenticación' });
    }

    const passwordHash = await bcrypt.hash(password, 10);

    const { data: nuevoUsuario, error } = await supabase
      .from('usuarios')
      .insert([{
        id: authData.user.id,
        auth_id: authData.user.id,
        id_rol: ID_ROL_CLIENTE,
        nombre,
        email,
        password: passwordHash,
        telefono: telefono || null
      }])
      .select('id, nombre, email, id_rol')
      .single();

    if (error) {
      await supabaseAuth.auth.admin.deleteUser(authData.user.id);
      console.error('Error al guardar el perfil del usuario registrado.');
      return res.status(400).json({ error: 'Error al registrar en la base de datos' });
    }

    const { data: sessionData, error: sessionError } = await supabaseAuth.auth.signInWithPassword({ email, password });
    if (sessionError || !sessionData.session) throw sessionError || new Error('No se pudo iniciar la sesión');

    const rol = await obtenerNombreRol(nuevoUsuario.id_rol) || 'cliente';
    res.status(201).json({
      mensaje: 'Usuario registrado con éxito',
      token: sessionData.session.access_token,
      refresh_token: sessionData.session.refresh_token,
      expires_at: sessionData.session.expires_at,
      usuario: {
        id: nuevoUsuario.id,
        nombre: nuevoUsuario.nombre,
        email: nuevoUsuario.email,
        rol,
        id_rol: nuevoUsuario.id_rol
      }
    });
  } catch (error) {
    console.error('Error general durante el registro:', error.name || 'Error');
    res.status(500).json({ error: 'Error en el servidor al registrar', detalle: error.message });
  }
});

// POST: Iniciar sesión
router.post('/login', loginRateLimit, async (req, res) => {
  auditarResultadoLogin(req, res);
  try {
    const email = String(req.body.email || '').trim().toLowerCase();
    const password = String(req.body.password || '');

    if (!email || !password) {
      return res.status(400).json({ error: 'Email y contraseña requeridos' });
    }

    const { data: authData, error: authError } = await supabaseAuth.auth.signInWithPassword({ email, password });
    if (!authError && authData.user && authData.session) {
      const { data: usuario, error } = await supabase
        .from('usuarios')
        .select('id, nombre, email, id_rol, telefono')
        .eq('email', email)
        .maybeSingle();

      if (error || !usuario) return res.status(401).json({ error: 'Perfil de usuario no encontrado' });
      const rol = await obtenerNombreRol(usuario.id_rol);
      return res.json({
        mensaje: 'Inicio de sesión exitoso',
        token: authData.session.access_token,
        refresh_token: authData.session.refresh_token,
        expires_at: authData.session.expires_at,
        usuario: {
          id: usuario.id,
          nombre: usuario.nombre,
          email: usuario.email,
          id_rol: usuario.id_rol,
          rol,
          telefono: usuario.telefono,
          documento: authData.user.user_metadata?.documento || ''
        }
      });
    }

    const { data: usuario, error } = await supabase
      .from('usuarios')
      .select('id, nombre, email, password, id_rol')
      .eq('email', email)
      .maybeSingle();

    if (error || !usuario) {
      return res.status(401).json({ error: 'Credenciales incorrectas' });
    }

    const esValida = await bcrypt.compare(password, usuario.password);
    if (!esValida) {
      return res.status(401).json({ error: 'Credenciales incorrectas' });
    }

    const rol = await obtenerNombreRol(usuario.id_rol);
    const session = crearSesionLocal(usuario);
    res.json({
      mensaje: 'Inicio de sesión exitoso',
      ...session,
      usuario: {
        id: usuario.id,
        nombre: usuario.nombre,
        email: usuario.email,
        id_rol: usuario.id_rol,
        rol
      }
    });
  } catch (error) {
    console.error('Error durante el inicio de sesión:', error.name || 'Error');
    res.status(500).json({ error: 'Error en el servidor durante el inicio de sesión' });
  }
});

router.post('/refresh', async (req, res) => {
  const refreshToken = String(req.body.refresh_token || '');
  if (!refreshToken) return res.status(400).json({ error: 'Refresh token requerido' });

  const { data, error } = await supabaseAuth.auth.refreshSession({ refresh_token: refreshToken });
  if (!error && data.session) {
    return res.json({
      token: data.session.access_token,
      refresh_token: data.session.refresh_token,
      expires_at: data.session.expires_at,
      usuario: data.user
    });
  }

  let payload;
  try {
    payload = jwt.verify(refreshToken, JWT_SECRET, {
      algorithms: ['HS256'],
      ignoreExpiration: true
    });
  } catch {
    return res.status(401).json({ error: 'La sesión no se puede renovar' });
  }

  const now = Math.floor(Date.now() / 1000);
  if (
    !payload.id ||
    !Number.isInteger(payload.exp) ||
    payload.exp < now - LOCAL_SESSION_MAX_AGE_SECONDS ||
    (payload.token_type === 'refresh' && payload.exp <= now)
  ) {
    return res.status(401).json({ error: 'La sesión no se puede renovar' });
  }

  const { data: usuario, error: userError } = await supabase
    .from('usuarios')
    .select('id, nombre, email, id_rol')
    .eq('id', payload.id)
    .maybeSingle();

  if (userError) throw userError;
  if (!usuario) return res.status(401).json({ error: 'La sesión no se puede renovar' });

  res.json({
    ...crearSesionLocal(usuario),
    usuario
  });
});

router.post('/recover', async (req, res) => {
  const email = String(req.body.email || '').trim().toLowerCase();
  if (!email) return res.status(400).json({ error: 'El correo electrónico es obligatorio' });

  const redirectTo = process.env.PASSWORD_RESET_REDIRECT_URL || 'http://localhost:3000/auth/cambiar-password.html';
  try {
    const { error } = await supabaseAuth.auth.resetPasswordForEmail(email, { redirectTo });
    if (error) {
      console.error('Supabase Auth rechazó la recuperación de contraseña.');
      return res.status(502).json({ error: 'No se pudieron enviar las instrucciones. Inténtalo más tarde.' });
    }

    res.json({ mensaje: 'Si el correo está registrado, recibirás instrucciones para recuperar la contraseña.' });
  } catch (error) {
    console.error('No se pudo completar la recuperación de contraseña.');
    res.status(502).json({ error: 'No se pudieron enviar las instrucciones. Inténtalo más tarde.' });
  }
});

router.put('/password', verificarToken, async (req, res) => {
  try {
    const password = String(req.body.password || '');
    if (password.length < 8) return res.status(400).json({ error: 'La contraseña debe tener al menos 8 caracteres' });

    if (req.usuario.auth_id) {
      const { error } = await supabaseAuth.auth.admin.updateUserById(req.usuario.auth_id, { password });
      if (error) throw error;
    } else {
      const passwordHash = await bcrypt.hash(password, 10);
      const { error } = await supabase.from('usuarios').update({ password: passwordHash }).eq('id', req.usuario.id);
      if (error) throw error;
    }

    await registrarAuditoria({ req, accion: 'cambiar_password', recurso: 'autenticacion', detalles: {} });
    res.json({ mensaje: 'Contraseña actualizada correctamente' });
  } catch (error) {
    console.error('No se pudo actualizar la contraseña:', error.name || 'Error');
    res.status(500).json({ error: 'No se pudo actualizar la contraseña' });
  }
});

router.put('/me', verificarToken, async (req, res) => {
  try {
    const nombre = String(req.body.nombre || '').trim();
    const email = String(req.body.email || '').trim().toLowerCase();
    const telefono = String(req.body.telefono || '').trim();
    const documento = String(req.body.documento || '').trim();

    if (!nombre || !email) {
      return res.status(400).json({ error: 'Nombre y correo son obligatorios' });
    }

    const { data: existente, error: lookupError } = await supabase
      .from('usuarios')
      .select('id')
      .eq('email', email)
      .neq('id', req.usuario.id)
      .maybeSingle();

    if (lookupError) throw lookupError;
    if (existente) return res.status(409).json({ error: 'El correo ya está registrado por otro usuario' });

    if (req.usuario.auth_id) {
      const { data: authProfile, error: authProfileError } = await supabaseAuth.auth.admin.getUserById(req.usuario.auth_id);
      if (authProfileError) throw authProfileError;

      const userMetadata = {
        ...(authProfile.user?.user_metadata || {}),
        nombre,
        telefono,
        documento
      };
      const { error: authUpdateError } = await supabaseAuth.auth.admin.updateUserById(req.usuario.auth_id, {
        email,
        user_metadata: userMetadata
      });
      if (authUpdateError) throw authUpdateError;
    } else if (documento) {
      return res.status(400).json({ error: 'No se pudo guardar el documento en esta cuenta. Contacta a soporte.' });
    }

    const { data, error } = await supabase
      .from('usuarios')
      .update({ nombre, email, telefono: telefono || null })
      .eq('id', req.usuario.id)
      .select('id, nombre, email, telefono, id_rol')
      .single();

    if (error) throw error;
    res.json({ mensaje: 'Perfil actualizado', usuario: { ...data, documento } });
  } catch (error) {
    console.error('No se pudo actualizar el perfil:', error.name || 'Error');
    res.status(500).json({ error: 'Error al actualizar el perfil' });
  }
});

router.get('/preferencias', verificarToken, async (req, res) => {
  res.json(await getPrefs(req.usuario.auth_id));
});

router.put('/preferencias', verificarToken, async (req, res) => {
  try {
    if (!req.usuario.auth_id) return res.status(400).json({ error: 'Tu cuenta no admite preferencias remotas' });
    res.json(await savePrefs(req.usuario.auth_id, req.body));
  } catch (error) {
    res.status(500).json({ error: 'No se pudieron guardar las preferencias', detalle: error.message });
  }
});

router.get('/verify', verificarToken, (req, res) => {
  res.json({ authenticated: true, usuario: req.usuario });
});

router.post('/logout', (_req, res) => {
  res.json({ authenticated: false, mensaje: 'Sesión cerrada' });
});

export default router;
