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
- **`src/app/server.js`**: El corazón del proyecto. Configura Express, sirve los archivos estáticos de `public/` y gestiona el punto de enlace (endpoint) del Asesor Financiero mediante el proxy a la API de Claude.

### 3. Directorio `docs/`
- Espacio centralizado para la documentación técnica, manuales de usuario y especificaciones de negocio (como este archivo).

## Usuarios de Prueba (Demo)

Para propósitos de demostración y pruebas de integración, se han preconfigurado los siguientes usuarios:

| Rol | Correo Electrónico | Contraseña | Destino (Dashboard) |
| --- | --- | --- | --- |
| **Administrador** | `admin@notaire.com` | `admin123` | `panel_control/admin/` |
| **Cliente** | `cliente@notaire.com` | `cliente123` | `panel_control/cliente/` |

## Seguridad y Protección de Rutas

Para garantizar la integridad del sistema y la privacidad de los usuarios, se ha implementado un esquema de seguridad de doble capa:

### 1. Protección de Backend (Middleware de Express)
El servidor (`server.js`) utiliza un middleware personalizado que protege la carpeta `/panel_control`. Sus funciones incluyen:
- **Verificación de Sesión**: Comprueba si existe una cookie de sesión válida (`session_token`) antes de servir cualquier archivo estático de los dashboards.
- **Control de Acceso Basado en Roles (RBAC)**: Valida que el rol del usuario autenticado corresponda a la carpeta a la que intenta acceder. Por ejemplo, un usuario con rol "cliente" no puede acceder a `/panel_control/admin/`.
- **Redirección Automática**: Si un usuario no está autenticado o intenta entrar a una zona prohibida, el servidor lo redirige automáticamente a la página de inicio de sesión.

### 2. Protección de Frontend (`auth-guard.js`)
Cada dashboard incluye un script ligero llamado `auth-guard.js` que:
- Realiza una comprobación instantánea al cargar la página para evitar visualizaciones accidentales de contenido protegido (flash of protected content).
- Gestiona el estado de la sesión en el navegador.
- Centraliza la función `logout()` para garantizar que la sesión se cierre correctamente tanto en el cliente como en el servidor.

### 3. Gestión de API
- Los endpoints sensibles de la API (como `/api/auth/verify`) también están protegidos y requieren una sesión activa para responder con información.

## Conclusión
La arquitectura actual prioriza la simplicidad y el rendimiento al utilizar tecnologías web nativas (HTML, CSS, JS) sin la sobrecarga de frameworks innecesarios, manteniendo una organización lógica fácil de navegar para cualquier desarrollador.
