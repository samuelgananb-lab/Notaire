-- ============================================================================
-- BASE DE DATOS NOTAIRE - CÓDIGO DIRECTO Y CONEXIONES RELACIONALES (SSMS 19)
-- ============================================================================

SET NOCOUNT ON;
GO

-- 1. CREAR BASE DE DATOS
IF NOT EXISTS (SELECT * FROM sys.databases WHERE name = 'NotaireDB')
BEGIN
    CREATE DATABASE NotaireDB;
END
GO

USE NotaireDB;
GO

-- 2. ELIMINAR CLAVES FORÁNEAS Y TABLAS PREVIAS DE MANERA LIMPIA
DECLARE @sql NVARCHAR(MAX) = N'';
SELECT @sql += N'ALTER TABLE ' + QUOTENAME(schema_name(schema_id)) + N'.' + QUOTENAME(object_name(parent_object_id)) + N' DROP CONSTRAINT ' + QUOTENAME(name) + N';' + CHAR(13)
FROM sys.foreign_keys;
EXEC sp_executesql @sql;
GO

IF OBJECT_ID('dbo.registros_financieros', 'U') IS NOT NULL DROP TABLE dbo.registros_financieros;
IF OBJECT_ID('dbo.metas_financieras', 'U') IS NOT NULL DROP TABLE dbo.metas_financieras;
IF OBJECT_ID('dbo.notificaciones', 'U') IS NOT NULL DROP TABLE dbo.notificaciones;
IF OBJECT_ID('dbo.usuarios', 'U') IS NOT NULL DROP TABLE dbo.usuarios;
IF OBJECT_ID('dbo.roles', 'U') IS NOT NULL DROP TABLE dbo.roles;
GO

-- ============================================================================
-- 3. CREACIÓN DE TABLAS CON SUS CONEXIONES EXACTAS (FOREIGN KEYS)
-- ============================================================================

-- 1. TABLA ROL
CREATE TABLE dbo.roles (
    id_rol INT IDENTITY(1,1) PRIMARY KEY,
    nombre_rol NVARCHAR(50) NOT NULL UNIQUE,
    descripcion NVARCHAR(255) NULL
);
GO

-- 2. TABLA USUARIOS (Conexión: FK id_rol -> roles.id_rol)
CREATE TABLE dbo.usuarios (
    id_usuario INT IDENTITY(1,1) PRIMARY KEY,
    id_rol INT NOT NULL,
    nombre NVARCHAR(150) NOT NULL,
    email NVARCHAR(150) NOT NULL UNIQUE,
    password NVARCHAR(255) NOT NULL,
    telefono NVARCHAR(50) NULL,
    documento_identidad NVARCHAR(50) NULL,
    tipo_documento NVARCHAR(20) DEFAULT 'CC',
    estado NVARCHAR(20) DEFAULT 'activo',
    fecha_registro DATETIME2 DEFAULT GETDATE(),
    CONSTRAINT FK_usuarios_rol FOREIGN KEY (id_rol) REFERENCES dbo.roles(id_rol)
);
GO

-- 3. TABLA NOTIFICACIONES (Conexión: FK id_usuario -> usuarios.id_usuario)
CREATE TABLE dbo.notificaciones (
    id_notificacion INT IDENTITY(1,1) PRIMARY KEY,
    id_usuario INT NOT NULL,
    titulo NVARCHAR(200) NOT NULL,
    mensaje NVARCHAR(MAX) NOT NULL,
    tipo NVARCHAR(50) DEFAULT 'sistema',
    estado_envio NVARCHAR(20) DEFAULT 'pendiente',
    fecha_envio DATETIME2 DEFAULT GETDATE(),
    CONSTRAINT FK_notificaciones_usuario FOREIGN KEY (id_usuario) REFERENCES dbo.usuarios(id_usuario) ON DELETE CASCADE
);
GO

-- 4. TABLA METAS FINANCIERAS (Conexión: FK id_usuario -> usuarios.id_usuario)
CREATE TABLE dbo.metas_financieras (
    id_meta INT IDENTITY(1,1) PRIMARY KEY,
    id_usuario INT NOT NULL,
    nombre_meta NVARCHAR(150) NOT NULL,
    monto_objetivo DECIMAL(12, 2) NOT NULL,
    monto_actual DECIMAL(12, 2) DEFAULT 0.00,
    fecha_limite DATETIME2 NULL,
    estado NVARCHAR(50) DEFAULT 'en_progreso',
    fecha_creacion DATETIME2 DEFAULT GETDATE(),
    CONSTRAINT FK_metas_usuario FOREIGN KEY (id_usuario) REFERENCES dbo.usuarios(id_usuario) ON DELETE CASCADE
);
GO

-- 5. TABLA REGISTROS FINANCIEROS (Conexiones: FK id_usuario -> usuarios.id_usuario, FK id_meta -> metas_financieras.id_meta)
CREATE TABLE dbo.registros_financieros (
    id_registro INT IDENTITY(1,1) PRIMARY KEY,
    id_usuario INT NOT NULL,
    id_meta INT NULL,
    monto DECIMAL(12, 2) NOT NULL,
    tipo_registro NVARCHAR(50) NOT NULL,
    categoria NVARCHAR(100) NOT NULL,
    descripcion NVARCHAR(MAX) NOT NULL,
    metodo_pago NVARCHAR(50) DEFAULT 'efectivo',
    fecha DATETIME2 DEFAULT GETDATE(),
    CONSTRAINT FK_registros_usuario FOREIGN KEY (id_usuario) REFERENCES dbo.usuarios(id_usuario) ON DELETE CASCADE,
    CONSTRAINT FK_registros_meta FOREIGN KEY (id_meta) REFERENCES dbo.metas_financieras(id_meta) ON DELETE NO ACTION
);
GO

-- ============================================================================
-- 4. DATOS DE DEMOSTRACIÓN (SEEDS INICIALES)
-- ============================================================================

SET IDENTITY_INSERT dbo.roles ON;
INSERT INTO dbo.roles (id_rol, nombre_rol, descripcion) VALUES
(1, N'admin', N'Administrador General'),
(2, N'cliente', N'Cliente Financiero'),
(3, N'empleado', N'Oficial de Operaciones');
SET IDENTITY_INSERT dbo.roles OFF;
GO

SET IDENTITY_INSERT dbo.usuarios ON;
INSERT INTO dbo.usuarios (id_usuario, id_rol, nombre, email, password, telefono, documento_identidad, tipo_documento, estado) VALUES
(1, 1, N'Administrador General', N'admin@notaire.com', N'admin123', N'+57 300 123 4567', N'1098765432', N'CC', N'activo'),
(2, 2, N'Cliente Ejemplo', N'cliente@notaire.com', N'cliente123', N'+57 315 987 6543', N'1012345678', N'CC', N'activo'),
(3, 3, N'Oficial de Operaciones', N'empleado@notaire.com', N'empleado123', N'+57 310 555 7788', N'79123456', N'CC', N'activo');
SET IDENTITY_INSERT dbo.usuarios OFF;
GO

SET IDENTITY_INSERT dbo.metas_financieras ON;
INSERT INTO dbo.metas_financieras (id_meta, id_usuario, nombre_meta, monto_objetivo, monto_actual, fecha_limite, estado) VALUES
(1, 2, N'Fondo de Reserva Notarial', 25000.00, 20000.00, '2026-12-31', N'en_progreso'),
(2, 2, N'Compra de Inmueble / Escritura', 50000.00, 15000.00, '2027-06-30', N'en_progreso');
SET IDENTITY_INSERT dbo.metas_financieras OFF;
GO

SET IDENTITY_INSERT dbo.registros_financieros ON;
INSERT INTO dbo.registros_financieros (id_registro, id_usuario, id_meta, monto, tipo_registro, categoria, descripcion, metodo_pago, fecha) VALUES
(1, 2, NULL, 450000.00, N'arancel', N'Servicios', N'Pago Honorarios por Asesoría Comercial', N'pse', '2026-08-05 14:35:00'),
(2, 2, NULL, 25000.00, N'arancel', N'Arancel', N'Pago Verificación Biométrica', N'efectivo', '2026-08-08 11:45:00'),
(3, 2, NULL, 12827.39, N'ingreso', N'Honorarios', N'Depósito de Nómina / Honorarios Mensuales', N'transferencia', '2026-08-01 08:00:00'),
(4, 2, 1, 2000.00, N'ahorro', N'Ahorro', N'Aporte a Fondo de Reserva Notarial', N'transferencia', '2026-08-03 12:00:00');
SET IDENTITY_INSERT dbo.registros_financieros OFF;
GO

SET IDENTITY_INSERT dbo.notificaciones ON;
INSERT INTO dbo.notificaciones (id_notificacion, id_usuario, titulo, mensaje, tipo, estado_envio, fecha_envio) VALUES
(1, 2, N'Movimiento de Saldo', N'Recepción de pago registrado por $450,000 COP.', N'saldo', N'enviado', '2026-08-09 18:20:00'),
(2, 2, N'Bienvenido a Notaire', N'Tu cuenta ha sido activada exitosamente en la plataforma.', N'sistema', N'leido', '2026-08-09 16:00:00');
SET IDENTITY_INSERT dbo.notificaciones OFF;
GO

PRINT '============================================================================='
PRINT ' Base de Datos NotaireDB Creada Correctamente con sus 5 Tablas y Conexiones.'
PRINT '============================================================================='
GO
