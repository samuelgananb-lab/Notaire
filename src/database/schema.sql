-- ==========================================
-- MODELO RELACIONAL DE BASE DE DATOS - SISTEMA NOTAIRE (5 TABLAS DEFINITIVAS)
-- 1. roles
-- 2. usuarios
-- 3. notificaciones
-- 4. metas_financieras
-- 5. registros_financieros
-- ==========================================

-- 1. Tabla de Roles
CREATE TABLE IF NOT EXISTS roles (
    id_rol INTEGER PRIMARY KEY AUTOINCREMENT,
    nombre_rol VARCHAR(50) UNIQUE NOT NULL,
    descripcion VARCHAR(255)
);

-- 2. Tabla de Usuarios
CREATE TABLE IF NOT EXISTS usuarios (
    id_usuario INTEGER PRIMARY KEY AUTOINCREMENT,
    id_rol INTEGER NOT NULL,
    nombre VARCHAR(150) NOT NULL,
    email VARCHAR(150) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    telefono VARCHAR(50),
    documento_identidad VARCHAR(50),
    tipo_documento VARCHAR(20) DEFAULT 'CC',
    estado VARCHAR(20) DEFAULT 'activo' CHECK(estado IN ('activo', 'inactivo', 'bloqueado')),
    fecha_registro DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (id_rol) REFERENCES roles(id_rol)
);

-- 3. Tabla de Notificaciones
CREATE TABLE IF NOT EXISTS notificaciones (
    id_notificacion INTEGER PRIMARY KEY AUTOINCREMENT,
    id_usuario INTEGER NOT NULL,
    titulo VARCHAR(200) NOT NULL,
    mensaje TEXT NOT NULL,
    tipo VARCHAR(50) DEFAULT 'sistema',
    estado_envio VARCHAR(20) DEFAULT 'pendiente' CHECK(estado_envio IN ('pendiente', 'enviado', 'leido')),
    fecha_envio DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (id_usuario) REFERENCES usuarios(id_usuario) ON DELETE CASCADE
);

-- 4. Tabla de Metas Financieras
CREATE TABLE IF NOT EXISTS metas_financieras (
    id_meta INTEGER PRIMARY KEY AUTOINCREMENT,
    id_usuario INTEGER NOT NULL,
    nombre_meta VARCHAR(150) NOT NULL,
    monto_objetivo DECIMAL(12, 2) NOT NULL,
    monto_actual DECIMAL(12, 2) DEFAULT 0.00,
    fecha_limite DATETIME,
    estado VARCHAR(50) DEFAULT 'en_progreso' CHECK(estado IN ('en_progreso', 'completada', 'cancelada')),
    fecha_creacion DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (id_usuario) REFERENCES usuarios(id_usuario) ON DELETE CASCADE
);

-- 5. Tabla de Registros Financieros (Transacciones)
CREATE TABLE IF NOT EXISTS registros_financieros (
    id_registro INTEGER PRIMARY KEY AUTOINCREMENT,
    id_usuario INTEGER NOT NULL,
    id_meta INTEGER,
    monto DECIMAL(12, 2) NOT NULL,
    tipo_registro VARCHAR(50) NOT NULL CHECK(tipo_registro IN ('ingreso', 'gasto', 'arancel', 'ahorro')),
    categoria VARCHAR(100) NOT NULL,
    descripcion TEXT NOT NULL,
    metodo_pago VARCHAR(50) DEFAULT 'efectivo',
    fecha DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (id_usuario) REFERENCES usuarios(id_usuario) ON DELETE CASCADE,
    FOREIGN KEY (id_meta) REFERENCES metas_financieras(id_meta) ON DELETE SET NULL
);

-- Índices de Optimización
CREATE INDEX IF NOT EXISTS idx_usuarios_email ON usuarios(email);
CREATE INDEX IF NOT EXISTS idx_usuarios_rol ON usuarios(id_rol);
CREATE INDEX IF NOT EXISTS idx_notificaciones_usuario ON notificaciones(id_usuario);
CREATE INDEX IF NOT EXISTS idx_metas_usuario ON metas_financieras(id_usuario);
CREATE INDEX IF NOT EXISTS idx_registros_usuario ON registros_financieros(id_usuario);
CREATE INDEX IF NOT EXISTS idx_registros_meta ON registros_financieros(id_meta);
