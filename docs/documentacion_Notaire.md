# Documentación del Proyecto Notaire

## Resumen
Este documento describe la estructura y el propósito del proyecto "Notaire". Se enfoca en una arquitectura limpia y minimalista para facilitar el mantenimiento y la escalabilidad.

## Estructura de Directorios (Actualizada)

Tras la reorganización, el proyecto mantiene una separación clara entre el backend y el frontend:

### 1. Directorio `public/` (Frontend)
Es la carpeta raíz de los archivos estáticos servidos por Express.
- **`index.html`**: La landing page principal de Notaire.
- **`assets/`**: Contiene los recursos compartidos.
  - `css/`: Estilos como `landing.css`.
  - `js/`: Lógica cliente como `landing.js`.
  - `image/`: Imágenes y recursos visuales.
- **`auth/`**: Contiene `login.html`, `register.html` y sus activos relacionados.
- **`panel_control/`**: Dashboards específicos para cada rol de usuario (Admin, Cliente).

### 2. Directorio `src/` (Backend)
- **`src/app/app.js`**: Configura Express, los headers de seguridad y las rutas de la API.
- **`src/app/server.js`**: Arranque local de Express mediante `npm start`.

### 3. Directorio `docs/`
- Espacio centralizado para la documentación técnica, manuales de usuario y especificaciones de negocio (como este archivo).

## Persistencia y migraciones

La persistencia activa del backend usa Supabase. Las tablas canónicas son:
`usuarios`, `roles`, `metas`, `aportes_meta`, `transacciones`, `recordatorios`,
`eventos_calendario` y `patrimonio`.

El backend activo usa Supabase. Los conectores legacy `db.js` y `db_mssql.js` y
el seed con cuentas de demostración fueron retirados porque no tenían
consumidores. `schema.sql` y `schema_sqlserver.sql` se conservan solo como
referencia histórica; no inicializan la aplicación activa.

## Autenticación y recuperación

El registro, el inicio de sesión, los roles y la recuperación de contraseña siguen
integrados con Supabase Auth. La recuperación usa `resetPasswordForEmail` y las
plantillas/configuración de correo propias de Supabase Auth; no depende del
sistema de correo transaccional de Notaire, que fue retirado.

No se incluyen cuentas ni contraseñas de demostración. Crea usuarios y asigna
roles mediante el flujo de administración configurado para cada entorno.

## Seguridad y Protección de Rutas

Las decisiones de acceso se aplican en la API; el guard del navegador solo
mejora la navegación y no sustituye la autorización del servidor.

### 1. Autorización de API
Las rutas protegidas verifican el token y resuelven el rol desde `public.usuarios`
y `public.roles`; el rol enviado dentro del token no se considera autoridad. Las
rutas administrativas y financieras aplican middleware de rol y propiedad.

### 2. Guard del navegador
`auth-guard.js` gestiona la sesión local, renueva tokens y redirige a login.
Las rutas del backend siguen siendo la barrera de seguridad efectiva.

### 3. Acceso a Supabase
La clave `SUPABASE_SERVICE_ROLE_KEY` solo se utiliza en el servidor. La migración
`backend_only_access_migration.sql` revoca acceso directo de `anon` y
`authenticated`; debe aplicarse manualmente en Supabase antes de considerar
completo el cierre de RLS.

## Conclusión
La arquitectura actual prioriza la simplicidad y el rendimiento al utilizar tecnologías web nativas (HTML, CSS, JS) sin la sobrecarga de frameworks innecesarios, manteniendo una organización lógica fácil de navegar para cualquier desarrollador.
