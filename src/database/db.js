/**
 * Módulo Gestor de Base de Datos - Notaire DB Engine (5 Tablas Definitivas)
 * 
 * Basado estrictamente en las 5 tablas del Modelo Relacional Notaire:
 * 1. ROL (roles)
 * 2. USUARIO (usuarios)
 * 3. META_FINANCIERA (metas_financieras)
 * 4. REGISTRO_FINANCIERO (registros_financieros)
 * 5. NOTIFICACION (notificaciones)
 */

const fs = require('fs');
const path = require('path');

const DB_FILE = path.join(__dirname, 'notaire.db.json');

class NotaireDatabase {
    constructor() {
        this.data = {
            roles: [],
            usuarios: [],
            metas_financieras: [],
            registros_financieros: [],
            notificaciones: []
        };
        this.init();
    }

    /**
     * Inicializa la Base de Datos.
     */
    init() {
        if (fs.existsSync(DB_FILE)) {
            try {
                const raw = fs.readFileSync(DB_FILE, 'utf8');
                const loaded = JSON.parse(raw);
                this.data = {
                    roles: loaded.roles || [],
                    usuarios: loaded.usuarios || [],
                    metas_financieras: loaded.metas_financieras || [],
                    registros_financieros: loaded.registros_financieros || [],
                    notificaciones: loaded.notificaciones || []
                };

                console.log('💾 [DB] Base de datos Modelo Relacional (5 Tablas) cargada.');
                return;
            } catch (err) {
                console.error('⚠️ [DB] Error al leer notaire.db.json, regenerando desde defaults:', err.message);
            }
        }

        console.log('⚡ [DB] Inicializando nueva Base de Datos Notaire (5 Tablas)...');
        this.seedFromDefaults();
        this.save();
    }

    /**
     * Guarda la base de datos en disco.
     */
    save() {
        try {
            fs.writeFileSync(DB_FILE, JSON.stringify(this.data, null, 2), 'utf8');
        } catch (err) {
            console.error('❌ [DB] Error al guardar en disco:', err);
        }
    }

    /**
     * Carga registros iniciales por defecto.
     */
    seedFromDefaults() {
        this.data = {
            roles: [
                { id_rol: 1, nombre_rol: 'admin', descripcion: 'Administrador General del Sistema Notaire' },
                { id_rol: 2, nombre_rol: 'cliente', descripcion: 'Usuario Final / Cliente Financiero' },
                { id_rol: 3, nombre_rol: 'empleado', descripcion: 'Oficial de Operaciones y Soporte' }
            ],
            usuarios: [
                { id_usuario: 1, id_rol: 1, nombre: 'Administrador General', email: 'admin@notaire.com', password: 'admin123', rol: 'admin', telefono: '+57 300 123 4567', documento_identidad: '1098765432', tipo_documento: 'CC', estado: 'activo', fecha_registro: new Date().toISOString() },
                { id_usuario: 2, id_rol: 2, nombre: 'Cliente Ejemplo', email: 'cliente@notaire.com', password: 'cliente123', rol: 'cliente', telefono: '+57 315 987 6543', documento_identidad: '1012345678', tipo_documento: 'CC', estado: 'activo', fecha_registro: new Date().toISOString() },
                { id_usuario: 3, id_rol: 3, nombre: 'Oficial de Operaciones', email: 'empleado@notaire.com', password: 'empleado123', rol: 'empleado', telefono: '+57 310 555 7788', documento_identidad: '79123456', tipo_documento: 'CC', estado: 'activo', fecha_registro: new Date().toISOString() }
            ],
            metas_financieras: [
                { id_meta: 1, id_usuario: 2, nombre_meta: 'Fondo de Reserva Notarial', monto_objetivo: 25000.00, monto_actual: 20000.00, fecha_limite: '2026-12-31', estado: 'en_progreso' },
                { id_meta: 2, id_usuario: 2, nombre_meta: 'Compra de Inmueble / Escritura', monto_objetivo: 50000.00, monto_actual: 15000.00, fecha_limite: '2027-06-30', estado: 'en_progreso' }
            ],
            registros_financieros: [
                { id_registro: 1, id_usuario: 2, id_meta: null, monto: 450000.00, tipo_registro: 'arancel', categoria: 'Servicios', descripcion: 'Pago Honorarios por Asesoría Comercial', metodo_pago: 'pse', fecha: '2026-08-05T14:35:00Z' },
                { id_registro: 2, id_usuario: 2, id_meta: null, monto: 25000.00, tipo_registro: 'arancel', categoria: 'Arancel', descripcion: 'Pago Verificación Biométrica', metodo_pago: 'efectivo', fecha: '2026-08-08T11:45:00Z' },
                { id_registro: 3, id_usuario: 2, id_meta: null, monto: 12827.39, tipo_registro: 'ingreso', categoria: 'Honorarios', descripcion: 'Depósito de Nómina / Honorarios Mensuales', metodo_pago: 'transferencia', fecha: '2026-08-01T08:00:00Z' },
                { id_registro: 4, id_usuario: 2, id_meta: 1, monto: 2000.00, tipo_registro: 'ahorro', categoria: 'Ahorro', descripcion: 'Aporte a Fondo de Reserva Notarial', metodo_pago: 'transferencia', fecha: '2026-08-03T12:00:00Z' }
            ],
            notificaciones: [
                { id_notificacion: 1, id_usuario: 2, titulo: 'Movimiento de Saldo', mensaje: 'Recepción de pago registrado por $450,000 COP.', tipo: 'saldo', estado_envio: 'enviado', fecha_envio: '2026-08-09T18:20:00Z' },
                { id_notificacion: 2, id_usuario: 2, titulo: 'Bienvenido a Notaire', mensaje: 'Tu cuenta ha sido activada exitosamente en la plataforma.', tipo: 'sistema', estado_envio: 'leido', fecha_envio: '2026-08-09T16:00:00Z' }
            ]
        };
    }

    // ==========================================
    // MÉTODOS PARA USUARIOS Y ROLES
    // ==========================================

    findUserByEmail(email) {
        if (!email) return null;
        return this.data.usuarios.find(u => u.email.toLowerCase() === email.toLowerCase()) || null;
    }

    findUserById(id) {
        return this.data.usuarios.find(u => (u.id_usuario === parseInt(id) || u.id === parseInt(id))) || null;
    }

    getUsuarios() {
        return this.data.usuarios.map(u => {
            const { password, ...safeUser } = u;
            return safeUser;
        });
    }

    createUser(user) {
        const id_usuario = this.data.usuarios.length ? Math.max(...this.data.usuarios.map(u => u.id_usuario || u.id || 0)) + 1 : 1;
        const roleObj = this.data.roles.find(r => r.nombre_rol === user.rol) || this.data.roles[1];
        
        const newUser = {
            id_usuario,
            id: id_usuario,
            id_rol: roleObj.id_rol,
            nombre: user.nombre || 'Usuario',
            email: user.email,
            password: user.password,
            rol: roleObj.nombre_rol,
            telefono: user.telefono || '',
            documento_identidad: user.documento_identidad || '',
            tipo_documento: user.tipo_documento || 'CC',
            estado: 'activo',
            fecha_registro: new Date().toISOString()
        };
        this.data.usuarios.push(newUser);
        this.save();
        return newUser;
    }

    // ==========================================
    // MÉTODOS PARA METAS Y REGISTROS FINANCIEROS
    // ==========================================

    getMetasFinancieras(usuarioId) {
        return this.data.metas_financieras.filter(m => m.id_usuario === parseInt(usuarioId));
    }

    getRegistrosFinancieros(usuarioId = null) {
        if (usuarioId) {
            return this.data.registros_financieros.filter(r => r.id_usuario === parseInt(usuarioId));
        }
        return this.data.registros_financieros;
    }

    createRegistroFinanciero(regData) {
        const id_registro = this.data.registros_financieros.length ? Math.max(...this.data.registros_financieros.map(r => r.id_registro || 0)) + 1 : 1;
        const newReg = {
            id_registro,
            id_usuario: parseInt(regData.id_usuario || regData.usuario_id),
            id_meta: regData.id_meta ? parseInt(regData.id_meta) : null,
            monto: parseFloat(regData.monto),
            tipo_registro: regData.tipo_registro || regData.tipo,
            categoria: regData.categoria || 'General',
            descripcion: regData.descripcion || regData.concepto,
            metodo_pago: regData.metodo_pago || 'efectivo',
            fecha: new Date().toISOString()
        };
        this.data.registros_financieros.push(newReg);

        if (newReg.id_meta) {
            const meta = this.data.metas_financieras.find(m => m.id_meta === newReg.id_meta);
            if (meta) {
                meta.monto_actual += newReg.monto;
                if (meta.monto_actual >= meta.monto_objetivo) {
                    meta.estado = 'completada';
                }
            }
        }

        this.save();
        return newReg;
    }

    getTransacciones(usuarioId) {
        return this.getRegistrosFinancieros(usuarioId);
    }

    createTransaccion(txData) {
        return this.createRegistroFinanciero(txData);
    }

    getPresupuesto(usuarioId) {
        const metas = this.getMetasFinancieras(usuarioId);
        const metaPrincipal = metas[0] || { monto_actual: 20000.00, monto_objetivo: 25000.00 };
        return {
            saldo_disponible: 8450.00,
            gastos_mensuales: 2340.00,
            ingresos_totales: 12827.39,
            ahorro_actual: metaPrincipal.monto_actual,
            meta_ahorro: metaPrincipal.monto_objetivo
        };
    }

    // ==========================================
    // MÉTODOS PARA NOTIFICACIONES
    // ==========================================

    getNotificaciones(usuarioId) {
        return this.data.notificaciones.filter(n => n.id_usuario === parseInt(usuarioId));
    }

    markNotificacionesAsRead(usuarioId) {
        this.data.notificaciones.forEach(n => {
            if (n.id_usuario === parseInt(usuarioId)) n.estado_envio = 'leido';
        });
        this.save();
    }

    // ==========================================
    // MÉTODOS PARA ADMINISTRACIÓN
    // ==========================================

    getMetricasAdmin() {
        const totalUsuarios = this.data.usuarios.length;
        const clientesActivos = this.data.usuarios.filter(u => u.rol === 'cliente' && u.estado === 'activo').length;
        const ingresosTotales = this.data.registros_financieros
            .filter(r => r.tipo_registro === 'arancel' || r.tipo_registro === 'ingreso')
            .reduce((acc, curr) => acc + (parseFloat(curr.monto) || 0), 0);

        return {
            totalUsuarios,
            clientesActivos,
            ingresosTotales
        };
    }
}

const db = new NotaireDatabase();

module.exports = db;
