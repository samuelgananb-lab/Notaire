/**
 * Módulo de Conexión y Consultas a SQL Server - Notaire DB (SSMS 19)
 * 
 * Conecta el servidor Express con la base de datos Microsoft SQL Server / SSMS 19
 * utilizando el driver oficial 'mssql'.
 */

const mssql = require('mssql');

// Cargar variables de entorno
try { require('dotenv').config(); } catch (e) {}

const config = {
    user: process.env.DB_USER || 'sa',
    password: process.env.DB_PASSWORD || 'TuPasswordSegura123',
    server: process.env.DB_SERVER || 'localhost', // Servidor de SQL Server (ej: localhost o IP)
    database: process.env.DB_NAME || 'NotaireDB',
    port: parseInt(process.env.DB_PORT || '1433'),
    options: {
        encrypt: process.env.DB_ENCRYPT === 'true', // Usar true si estás en Azure o SSL obligatorio
        trustServerCertificate: process.env.DB_TRUST_SERVER_CERTIFICATE !== 'false', // True para desarrollos locales / SSMS 19
        enableArithAbort: true
    },
    pool: {
        max: 10,
        min: 0,
        idleTimeoutMillis: 30000
    }
};

let poolPromise = null;

/**
 * Obtiene la conexión activa o crea un nuevo pool hacia SQL Server
 */
async function getPool() {
    if (!poolPromise) {
        poolPromise = mssql.connect(config)
            .then(pool => {
                console.log('✅ [SQL SERVER] Conexión establecida exitosamente a NotaireDB en SQL Server.');
                return pool;
            })
            .catch(err => {
                console.error('❌ [SQL SERVER] Error al conectar a SQL Server:', err.message);
                poolPromise = null;
                throw err;
            });
    }
    return poolPromise;
}

/**
 * Ejecuta una consulta SQL libre (Raw SQL Query)
 * @param {string} queryStr - Instrucción T-SQL a ejecutar
 * @param {object} params - Parámetros clave/valor para evitar inyección SQL
 */
async function query(queryStr, params = {}) {
    try {
        const pool = await getPool();
        const request = pool.request();
        
        // Asignar parámetros dinámicos
        for (const [key, value] of Object.entries(params)) {
            request.input(key, value);
        }

        const result = await request.query(queryStr);
        return result.recordset || result;
    } catch (err) {
        console.error('⚠️ [SQL SERVER Error Query]:', err.message);
        throw err;
    }
}

/**
 * Comprueba el estado de la conexión a SQL Server
 */
async function checkConnection() {
    try {
        const result = await query('SELECT GETDATE() AS server_time, DB_NAME() AS current_db');
        return { success: true, data: result[0] };
    } catch (err) {
        return { success: false, error: err.message };
    }
}

module.exports = {
    mssql,
    config,
    getPool,
    query,
    checkConnection
};
