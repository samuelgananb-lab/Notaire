-- ==========================================
-- NOTAIRE INITIAL SEED DATA (seed.sql)
-- Registros Iniciales para las 5 Tablas del Modelo Relacional Notaire
-- ==========================================

-- 1. Roles
INSERT INTO roles (id_rol, nombre_rol, descripcion) VALUES
(1, 'admin', 'Administrador General del Sistema Notaire'),
(2, 'cliente', 'Usuario Final / Cliente Financiero'),
(3, 'empleado', 'Oficial de Operaciones y Soporte');

-- 2. Usuarios
INSERT INTO usuarios (id_usuario, id_rol, nombre, email, password, telefono, documento_identidad, tipo_documento, estado) VALUES
(1, 1, 'Administrador General', 'admin@notaire.com', 'admin123', '+57 300 123 4567', '1098765432', 'CC', 'activo'),
(2, 2, 'Cliente Ejemplo', 'cliente@notaire.com', 'cliente123', '+57 315 987 6543', '1012345678', 'CC', 'activo'),
(3, 3, 'Oficial de Operaciones', 'empleado@notaire.com', 'empleado123', '+57 310 555 7788', '79123456', 'CC', 'activo');

-- 3. Metas Financieras
INSERT INTO metas_financieras (id_meta, id_usuario, nombre_meta, monto_objetivo, monto_actual, fecha_limite, estado) VALUES
(1, 2, 'Fondo de Reserva Notarial', 25000.00, 20000.00, '2026-12-31', 'en_progreso'),
(2, 2, 'Compra de Inmueble / Escritura', 50000.00, 15000.00, '2027-06-30', 'en_progreso');

-- 4. Registros Financieros (Transacciones)
INSERT INTO registros_financieros (id_registro, id_usuario, id_meta, monto, tipo_registro, categoria, descripcion, metodo_pago, fecha) VALUES
(1, 2, NULL, 450000.00, 'arancel', 'Servicios', 'Pago Honorarios por Asesoría Comercial', 'pse', '2026-08-05 14:35:00'),
(2, 2, NULL, 25000.00, 'arancel', 'Arancel', 'Pago Verificación Biométrica', 'efectivo', '2026-08-08 11:45:00'),
(3, 2, NULL, 12827.39, 'ingreso', 'Honorarios', 'Depósito de Nómina / Honorarios Mensuales', 'transferencia', '2026-08-01 08:00:00'),
(4, 2, 1, 2000.00, 'ahorro', 'Ahorro', 'Aporte a Fondo de Reserva Notarial', 'transferencia', '2026-08-03 12:00:00');

-- 5. Notificaciones
INSERT INTO notificaciones (id_notificacion, id_usuario, titulo, mensaje, tipo, estado_envio, fecha_envio) VALUES
(1, 2, 'Movimiento de Saldo', 'Recepción de pago registrado por $450,000 COP.', 'saldo', 'enviado', '2026-08-09 18:20:00'),
(2, 2, 'Bienvenido a Notaire', 'Tu cuenta ha sido activada exitosamente en la plataforma.', 'sistema', 'leido', '2026-08-09 16:00:00');
