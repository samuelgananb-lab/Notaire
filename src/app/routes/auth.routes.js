import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { supabase, supabaseAuth } from '../database/supabase.js';
import { JWT_SECRET, verificarToken } from '../middlewares/auth.middleware.js';
import { loginRateLimit } from '../middlewares/login-rate-limit.middleware.js';
import { registrarAuditoria } from '../services/audit.service.js';
import { sendNotificationEmail } from '../services/event-notifications.service.js';
import { getPrefs, savePrefs } from '../services/notification-prefs.service.js';

const router = Router();
const ID_ROL_CLIENTE = '11111111-1111-1111-1111-111111111111';

function auditarResultadoLogin(req, res) {
  res.once('finish', () => {
    if (![200, 401].includes(res.statusCode)) return;
    registrarAuditoria({
      req,
      accion: res.statusCode === 200 ? 'login_exitoso' : 'login_fallido',
      recurso: 'autenticacion',
      detalles: { email: String(req.body.email || '').trim().toLowerCase(), status: res.statusCode }
    });
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
      return res.status(400).json({ error: 'No se pudo crear la cuenta de autenticación', detalle: authError?.message });
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
      console.error('Error al insertar usuario en Supabase:', error);
      return res.status(400).json({ error: 'Error al registrar en la base de datos', detalle: error.message });
    }

    const { data: sessionData, error: sessionError } = await supabaseAuth.auth.signInWithPassword({ email, password });
    if (sessionError || !sessionData.session) throw sessionError || new Error('No se pudo iniciar la sesión');

    const rol = await obtenerNombreRol(nuevoUsuario.id_rol) || 'cliente';
    void sendNotificationEmail({
      to: nuevoUsuario.email,
      subject: 'Bienvenido a Notaire',
      text: `Hola ${nuevoUsuario.nombre},\n\nTu cuenta fue creada correctamente. Ya puedes ingresar a Notaire para consultar tus finanzas y gestionar tus trámites.\n\nSi no creaste esta cuenta, responde a este correo para solicitar ayuda.`
    });

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
    console.error('Error general en el servidor:', error);
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
      void sendNotificationEmail({
        to: usuario.email,
        subject: 'Nuevo inicio de sesión',
        text: `Hola ${usuario.nombre},\n\nSe inició sesión en tu cuenta de Notaire el ${new Date().toLocaleString('es-CO')}.\n\nSi no reconoces este acceso, cambia tu contraseña y contacta al equipo de soporte.`
      });
      return res.json({
        mensaje: 'Inicio de sesión exitoso',
        token: authData.session.access_token,
        refresh_token: authData.session.refresh_token,
        expires_at: authData.session.expires_at,
        usuario: { id: usuario.id, nombre: usuario.nombre, email: usuario.email, id_rol: usuario.id_rol, rol, telefono: usuario.telefono }
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
    void sendNotificationEmail({
      to: usuario.email,
      subject: 'Nuevo inicio de sesión',
      text: `Hola ${usuario.nombre},\n\nSe inició sesión en tu cuenta de Notaire el ${new Date().toLocaleString('es-CO')}.\n\nSi no reconoces este acceso, cambia tu contraseña y contacta al equipo de soporte.`
    });

    const token = jwt.sign(
      { id: usuario.id, email: usuario.email, id_rol: usuario.id_rol },
      JWT_SECRET,
      { expiresIn: '24h' }
    );

    res.json({
      mensaje: 'Inicio de sesión exitoso',
      token,
      usuario: {
        id: usuario.id,
        nombre: usuario.nombre,
        email: usuario.email,
        id_rol: usuario.id_rol,
        rol
      }
    });
  } catch (error) {
    console.error('Error en el login:', error);
    res.status(500).json({ error: 'Error en el servidor durante el inicio de sesión' });
  }
});

router.post('/refresh', async (req, res) => {
  const refreshToken = String(req.body.refresh_token || '');
  if (!refreshToken) return res.status(400).json({ error: 'Refresh token requerido' });

  const { data, error } = await supabaseAuth.auth.refreshSession({ refresh_token: refreshToken });
  if (error || !data.session) return res.status(401).json({ error: 'La sesión no se puede renovar' });

  res.json({
    token: data.session.access_token,
    refresh_token: data.session.refresh_token,
    expires_at: data.session.expires_at,
    usuario: data.user
  });
});

router.post('/recover', async (req, res) => {
  const email = String(req.body.email || '').trim().toLowerCase();
  if (!email) return res.status(400).json({ error: 'El correo electrónico es obligatorio' });

  const redirectTo = process.env.PASSWORD_RESET_REDIRECT_URL || 'http://localhost:3000/auth/cambiar-password.html';
  const { error } = await supabaseAuth.auth.resetPasswordForEmail(email, { redirectTo });
  if (error) console.error('Error en recuperación de contraseña:', error.message);

  res.json({ mensaje: 'Si el correo está registrado, recibirás instrucciones para recuperar la contraseña.' });
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
    void sendNotificationEmail({
      to: req.usuario.email,
      subject: 'Contraseña actualizada',
      text: 'La contraseña de tu cuenta Notaire fue actualizada. Si no reconoces este cambio, contacta de inmediato al equipo de soporte.'
    });
    res.json({ mensaje: 'Contraseña actualizada correctamente' });
  } catch (error) {
    res.status(500).json({ error: 'No se pudo actualizar la contraseña', detalle: error.message });
  }
});

router.put('/me', verificarToken, async (req, res) => {
  try {
    const nombre = String(req.body.nombre || '').trim();
    const email = String(req.body.email || '').trim().toLowerCase();
    const telefono = String(req.body.telefono || '').trim();

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
      const { error: authUpdateError } = await supabaseAuth.auth.admin.updateUserById(req.usuario.auth_id, { email });
      if (authUpdateError) throw authUpdateError;
    }

    const { data, error } = await supabase
      .from('usuarios')
      .update({ nombre, email, telefono: telefono || null })
      .eq('id', req.usuario.id)
      .select('id, nombre, email, telefono, id_rol')
      .single();

    if (error) throw error;
    const aviso = `Hola ${nombre},\n\nLos datos de tu perfil en Notaire fueron actualizados. Si no reconoces este cambio, contacta de inmediato al equipo de soporte.`;
    void sendNotificationEmail({ to: email, subject: 'Perfil actualizado', text: aviso });
    if (req.usuario.email && req.usuario.email.toLowerCase() !== email) {
      void sendNotificationEmail({ to: req.usuario.email, subject: 'Tu correo fue cambiado', text: `El correo de tu cuenta Notaire cambió a ${email}. Si no fuiste tú, contacta de inmediato al equipo de soporte.` });
    }
    res.json({ mensaje: 'Perfil actualizado', usuario: data });
  } catch (error) {
    res.status(500).json({ error: 'Error al actualizar el perfil', detalle: error.message });
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
