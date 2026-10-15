Notaire usa actualmente **Supabase** como base de datos. El código del servidor consulta las tablas del esquema `public`.
# La idea principal

Cada persona tiene una cuenta en `usuarios` y un rol guardado en `roles`. Según ese rol, Notaire permite usar distintas partes del sistema.

roles ── usuarios ──┬── transacciones
                    ├── metas ── aportes_meta
                    ├── recordatorios
                    ├── eventos_calendario
                    ├── patrimonio
                    ├── tramites_notariales
                    └── auditoria_acciones
```

Los campos llamados `id`, `usuario_id`, `meta_id`, `actor_id` o `responsable_id` sirven para relacionar registros. Por ejemplo, `usuario_id` permite saber a qué usuario pertenece un movimiento.

## Tablas activas

### 1. `roles`

Define los tipos de usuario que puede tener el sistema.

- `id_rol`: identificador del rol.
- `nombre_rol`: nombre, por ejemplo `admin`, `cliente` o `empleado`.

La tabla `usuarios` guarda el `id_rol` de cada persona. Así se puede saber qué permisos y panel le corresponden.

### 2. `usuarios`

Guarda el perfil de cada persona que usa Notaire.

- `id`: identificador único del usuario.
- `auth_id`: identificador que lo vincula con el servicio de autenticación de Supabase, si la cuenta está vinculada.
- `id_rol`: rol de la persona; conecta con `roles`.
- `nombre`, `email`, `telefono`: datos del perfil.
- `password`: hash de contraseña usado para compatibilidad con el inicio de sesión anterior. No debe contener una contraseña legible.

Supabase Auth gestiona la autenticación de las cuentas vinculadas. El servidor también mantiene algunos datos de acceso en esta tabla para dar compatibilidad a cuentas anteriores.

### 3. `transacciones`

Registra los movimientos de dinero del usuario.

- `id`: identificador del movimiento.
- `usuario_id`: dueño del movimiento; conecta con `usuarios`.
- `tipo`: `ingreso` o `gasto`.
- `monto`: valor del movimiento.
- `categoria` y `descripcion`: clasificación y detalle.
- `fecha`: día del movimiento.

Los ingresos aumentan y los gastos reducen el saldo. El disponible se calcula con los movimientos acumulados menos el dinero reservado en metas; no se guarda como un saldo independiente.

### 4. `metas`

Guarda los objetivos de ahorro de cada usuario.

- `id`: identificador de la meta.
- `usuario_id`: dueño; conecta con `usuarios`.
- `nombre`: título de la meta.
- `monto_objetivo`: cuánto se quiere ahorrar.
- `monto_actual`: cuánto se ha reunido.
- `fecha_limite`: fecha objetivo, si existe.
- `icono`: símbolo visual opcional.

### 5. `aportes_meta`

Guarda cada aporte individual hecho a una meta. Es el historial de cómo va creciendo el ahorro.

- `id`: identificador del aporte.
- `meta_id`: meta a la que se aportó; conecta con `metas`.
- `usuario_id`: persona que hizo el aporte; conecta con `usuarios`.
- `monto`: cantidad aportada.
- `fecha`: cuándo se registró.

La diferencia sencilla es: `metas` muestra el total actual y `aportes_meta` muestra cada movimiento que contribuyó a ese total.

### 6. `recordatorios`

Guarda compromisos financieros, como una factura o un pago próximo.

- `id`: identificador del recordatorio.
- `usuario_id`: dueño; conecta con `usuarios`.
- `titulo`: nombre del compromiso.
- `monto`: valor esperado.
- `fecha_vencimiento`: fecha de pago.
- `estado`: normalmente `pendiente` o `pagado`.
- `email_24h_sent` y `email_due_sent`: indican si ya se enviaron los avisos automáticos de vencimiento.

Las dos últimas columnas son necesarias para que el sistema no mande el mismo correo repetidamente. Se agregan con `recordatorios_notificaciones_migration.sql`.

### 7. `eventos_calendario`

Guarda eventos personales, financieros o notariales del calendario.

- `id`: identificador del evento.
- `usuario_id`: dueño; conecta con `usuarios`.
- `titulo`, `tipo` y `nota`: descripción y categoría.
- `fecha`, `hora` y `fecha_hora`: cuándo ocurre.
- `notif24h`, `notif1h` y `notifonday`: preferencias para avisar antes o el mismo día.
- `notif24_sent`, `notif1h_sent` y `notifonday_sent`: marcas que evitan enviar el mismo aviso más de una vez.
- `estado`: situación del evento, por ejemplo pendiente.

Las columnas del evento se incorporan con `eventos_calendario_migration.sql` y `eventos_notificaciones_migration.sql`.

### 8. `patrimonio`

Guarda activos y pasivos del usuario para calcular su patrimonio.

- `id`: identificador del registro.
- `usuario_id`: dueño; conecta con `usuarios`.
- `tipo`: indica si es activo o pasivo.
- `categoria`: clasificación, como cuenta o inversión.
- `monto`: valor registrado.

Con registros manuales, el patrimonio neto se calcula restando los pasivos a los activos. Sin ellos, el panel usa el saldo acumulado de movimientos como estimación financiera.

### 9. `tramites_notariales`

Organiza los trámites que atiende Notaire y quién participa en cada uno.

- `id`: identificador del trámite.
- `usuario_id`: cliente relacionado; conecta con `usuarios`.
- `responsable_id`: empleado responsable; también conecta con `usuarios`.
- `tipo` y `titulo`: clase y nombre del trámite.
- `estado`: etapa, por ejemplo recibido, en revisión, pendiente, aprobado, finalizado o rechazado.
- `fecha_limite`: fecha objetivo, si existe.
- `descripcion`: notas o detalles.
- `created_at` y `updated_at`: fechas de creación y última actualización.

La estructura se define en `tramites_migration.sql`.

### 10. `auditoria_acciones`

Conserva un historial de acciones importantes realizadas en el sistema.

- `id`: identificador del registro.
- `actor_id`: usuario que hizo la acción; conecta con `usuarios`.
- `accion`: qué ocurrió, por ejemplo crear un trámite o cambiar un rol.
- `recurso` y `recurso_id`: qué elemento fue afectado.
- `detalles`: información adicional en formato JSON.
- `ip_address` y `user_agent`: datos técnicos de la conexión.
- `created_at`: cuándo ocurrió.

Esta tabla sirve para revisar actividad y seguridad. La migración `auditoria_migration.sql` activa seguridad RLS y limita la lectura a administradores.

## Cómo se conectan en ejemplos

**Al crear una cuenta:** Supabase Auth crea la credencial; `usuarios` guarda el perfil; `roles` indica si es cliente, empleado o administrador.

**Al registrar un gasto:** se crea una fila en `transacciones` con el `usuario_id` de quien lo registró y el tipo `gasto`.

**Al ahorrar para una meta:** `aportes_meta` registra el aporte y `metas.monto_actual` refleja el total reunido.

**Al crear un trámite:** `tramites_notariales.usuario_id` apunta al cliente y `responsable_id` apunta al empleado encargado.

## Seguridad y acceso

El backend valida la identidad antes de consultar datos. Las rutas de cliente filtran por el identificador del usuario; las operaciones administrativas comprueban los roles. Supabase también permite activar **Row Level Security** para aplicar reglas de acceso en la base de datos.

Los valores secretos de Supabase y de correo se mantienen en `.env` y nunca deben copiarse a documentación o al frontend.

## Referencia técnica completa

Esta sección describe qué base usa el backend actual, qué tablas consulta, qué scripts están disponibles y cuáles son las limitaciones del esquema que vive en el repositorio. La fuente de verdad de las consultas de la aplicación está en `src/app/routes/` y `src/app/services/`; no todos los objetos consultados tienen un `CREATE TABLE` versionado en `src/database/`.

### Motor activo y tablas

El servidor actual crea el cliente de `@supabase/supabase-js` en `src/app/database/supabase.js` y usa el esquema `public`. El cliente se conecta con `SUPABASE_URL` y `SUPABASE_SERVICE_ROLE_KEY`, que deben existir solo en el entorno del servidor. `service_role` tiene privilegios elevados y no debe exponerse en el navegador.

| Tabla | Uso | Columnas confirmadas por SQL o consultas del servidor |
| --- | --- | --- |
| `roles` | Catálogo de perfiles y permisos. | `id_rol`, `nombre_rol`; `roles_migration.sql` reserva el UUID `33333333-3333-3333-3333-333333333333` para `empleado`. Las rutas también consultan `admin` y `cliente`. |
| `usuarios` | Perfil y vínculo con autenticación. | `id`, `auth_id`, `id_rol`, `nombre`, `email`, `password`, `telefono`. `auth_id` es un UUID único agregado por la migración de Auth; el código crea perfiles con `id` y `auth_id` iguales al UUID de Supabase Auth. `password` se consulta para compatibilidad con cuentas antiguas y debe guardar un hash, nunca texto plano. |
| `metas` | Objetivos de ahorro. | Definición exacta en `supabase_schema.sql`: `id bigint identity`, `usuario_id uuid`, `nombre varchar(150)`, `monto_objetivo numeric(12,2)`, `monto_actual numeric(12,2)`, `fecha_limite date`, `icono text`. El objetivo debe ser mayor que cero y el monto actual no puede ser negativo. |
| `aportes_meta` | Historial de aportes a metas. | `id bigint identity`, `meta_id bigint`, `usuario_id uuid`, `monto numeric(12,2)`, `fecha timestamptz`. El monto debe ser positivo. |
| `transacciones` | Ingresos y gastos del usuario. | `id bigint identity`, `usuario_id uuid`, `tipo varchar(20)`, `monto numeric(12,2)`, `categoria varchar(100)`, `descripcion text`, `fecha date`. El tipo admite `ingreso` o `gasto`, y el monto debe ser positivo. |
| `recordatorios` | Compromisos financieros con vencimiento. | Las rutas consultan `id`, `usuario_id`, `titulo`, `monto`, `fecha_vencimiento`, `estado`; la migración añade `email_24h_sent` y `email_due_sent` como booleanos. Los estados usados por la API son `pendiente` y `pagado`. No hay un `CREATE TABLE` de esta tabla en los SQL actuales. |
| `eventos_calendario` | Eventos personales, financieros o notariales. | Las rutas usan `id`, `usuario_id`, `titulo`, `tipo`, `fecha`, `hora`, `fecha_hora`, `nota`, `estado`, `notif24h`, `notif1h`, `notifonday`, `notif24_sent`, `notif1h_sent` y `notifonday_sent`. Las dos migraciones de eventos añaden esos campos, pero presuponen que la tabla ya existe. |
| `patrimonio` | Activos y pasivos financieros. | Las rutas consultan `id`, `usuario_id`, `tipo`, `categoria`, `monto`. El cálculo neto suma los tipos que empiezan por `activo` y resta los que empiezan por `pasivo`. No hay un `CREATE TABLE` de esta tabla en los SQL actuales. |
| `tramites_notariales` | Trámites, cliente y responsable. | Definición exacta en `tramites_migration.sql`: `id`, `usuario_id`, `responsable_id`, `tipo`, `titulo`, `estado`, `fecha_limite`, `descripcion`, `created_at`, `updated_at`. El estado está limitado a `recibido`, `en_revision`, `pendiente`, `aprobado`, `finalizado` o `rechazado`. |
| `auditoria_acciones` | Registro de acciones sensibles y administrativas. | Definición exacta en `auditoria_migration.sql`: `id`, `actor_id`, `accion`, `recurso`, `recurso_id`, `detalles jsonb`, `ip_address inet`, `user_agent`, `created_at`. `detalles` inicia como objeto JSON vacío. |

Los tipos, restricciones y valores por defecto de `roles`, `usuarios`, `recordatorios`, `eventos_calendario` y `patrimonio` no se pueden confirmar por completo en este repositorio: faltan sus scripts de creación. La tabla resume el contrato observado en las migraciones y en el código servidor, no sustituye una exportación del esquema real de Supabase.

### Relaciones

```text
roles (1) ─────────── (N) usuarios
usuarios (1) ──────── (N) metas
metas (1) ────────── (N) aportes_meta
usuarios (1) ──────── (N) aportes_meta
usuarios (1) ──────── (N) transacciones
usuarios (1) ──────── (N) recordatorios
usuarios (1) ──────── (N) eventos_calendario
usuarios (1) ──────── (N) patrimonio
usuarios (1) ──────── (N) tramites_notariales como cliente
usuarios (1) ──────── (N) tramites_notariales como responsable
usuarios (1) ──────── (N) auditoria_acciones como actor (opcional)
```

Las claves foráneas de `metas`, `aportes_meta`, `transacciones`, `tramites_notariales` y `auditoria_acciones` aparecen en sus SQL versionados. Las relaciones de las demás tablas se deducen de las consultas de la aplicación y deben verificarse en el proyecto remoto. Al borrar un usuario, las relaciones financieras definidas en `supabase_schema.sql` se eliminan en cascada; en trámites, cliente y responsable quedan en `NULL`; en auditoría, el actor queda en `NULL` para conservar el registro.

### Cálculos y reglas de negocio

- `aportes_meta` conserva cada aporte, mientras que `metas.monto_actual` mantiene el acumulado que muestran los paneles. La ruta de metas actualiza ambos registros; no existe una función SQL o trigger versionado que garantice esa sincronización fuera de la API.
- Las tarjetas y categorías mensuales incluyen solo movimientos del mes calendario actual en la zona horaria `America/Bogota`; los gráficos de gastos excluyen ingresos. El disponible de presupuesto es presupuesto mensual menos gastos del mes y puede ser negativo si se excede.
- El saldo disponible se calcula como ingresos acumulados menos gastos acumulados menos el total reservado en metas. El ahorro en metas es una reserva de ese saldo, no un gasto adicional al calcular el patrimonio.
- Si hay activos o pasivos registrados, el patrimonio neto es activos menos pasivos. Si no hay registros manuales, se estima como ingresos acumulados menos gastos acumulados; los activos y pasivos siguen mostrando solo los valores registrados manualmente.
- La dona de distribución en los paneles de cliente y empleado comparte la misma fórmula y los mismos valores acumulados: gastos, ahorros y disponible (ingresos menos gastos y ahorros, sin representar un disponible negativo como segmento).
- Las banderas `email_24h_sent`, `email_due_sent` y las banderas `notif*_sent` evitan repetir avisos en cada ejecución del proceso de notificaciones. Cuando un evento cambia de fecha u hora, la API reinicia sus banderas de envío.
- Los trámites y los recordatorios tienen estados validados por la API. La restricción SQL de estados solo está definida explícitamente para `tramites_notariales`.

### Catálogo de scripts de `src/database/`

| Archivo | Propósito y precauciones |
| --- | --- |
| `supabase_schema.sql` | Crea `metas`, `aportes_meta` y `transacciones`, sus restricciones e índices. Requiere que `public.usuarios` ya exista. El comentario inicial menciona más tablas activas que las que el archivo realmente crea. |
| `supabase_metas.sql` | Repite la creación de `metas` y `aportes_meta` e índices. Es redundante con esa parte de `supabase_schema.sql`; no se necesita ejecutar ambos para crear esas tablas. |
| `roles_migration.sql` | Inserta o actualiza el rol `empleado` y lista los roles. Requiere que `public.roles` exista; no crea los roles `admin` ni `cliente`. |
| `supabase_auth_migration.sql` | Agrega `usuarios.auth_id` y habilita RLS para metas, aportes, transacciones, recordatorios y patrimonio. Las políticas aceptan que el UUID del token corresponda a `usuarios.auth_id` o a `usuarios.id`. Requiere que esas tablas ya existan. |
| `supabase_rls.sql` | Otra definición de políticas para esas cinco tablas. Compara directamente `auth.uid()` con `usuario_id`; esta regla no es equivalente a la compatibilidad `auth_id` de la migración anterior. Elige y verifica deliberadamente una estrategia antes de ejecutarla. |
| `recordatorios_notificaciones_migration.sql` | Añade dos banderas de envío a `recordatorios`; presupone que la tabla existe. |
| `eventos_calendario_migration.sql` | Añade fecha, hora, fecha-hora, nota y preferencias de aviso; crea un índice por usuario y fecha. Presupone que la tabla existe. |
| `eventos_notificaciones_migration.sql` | Añade banderas de envío y estado a `eventos_calendario`; presupone que la tabla existe. |
| `tramites_migration.sql` | Crea trámites, índices y una política RLS. La política actual permite todas las operaciones a cualquier usuario autenticado; véase la advertencia de seguridad más abajo. |
| `auditoria_migration.sql` | Crea auditoría, índices y una política para que administradores autenticados lean registros. La comprobación de administrador compara `usuarios.id` con `auth.uid()`, no consulta `auth_id`. |
| `solicitudes_empleado_migration.sql` | Crea `solicitudes_empleado` (solicitudes y reportes de clientes y empleados). Idempotente. |

### Instalación y migraciones Supabase

No existe en el repositorio un script único que inicialice completamente una base Supabase vacía. Varias migraciones parten de tablas que no crean, en particular `usuarios`, `roles`, `recordatorios`, `eventos_calendario` y `patrimonio`. Antes de ejecutar migraciones en un entorno nuevo, compara este documento con el esquema real y crea o importa esas tablas con sus tipos, claves y restricciones.

Para una base que ya tenga las tablas base, el orden orientativo es:

1. Confirmar `usuarios` y `roles`, incluyendo las columnas usadas por autenticación y el perfil.
2. Ejecutar `supabase_schema.sql` para el modelo financiero, si esas tablas aún no existen.
3. Crear previamente `recordatorios`, `eventos_calendario` y `patrimonio` si faltan; aplicar sus migraciones de notificaciones/eventos después.
4. Ejecutar `roles_migration.sql` si se necesita agregar o corregir el rol `empleado`.
5. Ejecutar `tramites_migration.sql` y `auditoria_migration.sql` para esos módulos.
6. Elegir una sola estrategia de políticas de propietario y revisar las políticas de auditoría y trámites antes de habilitar el acceso de usuarios.

Las migraciones con `add column if not exists` pueden repetirse para las columnas, pero eso no garantiza que todas las operaciones sean idempotentes o que el esquema resultante sea seguro. Usa primero un entorno de prueba, respalda los datos y valida las políticas con cuentas de distintos roles.

### Seguridad: límites conocidos

- El cliente Supabase del backend usa `SUPABASE_SERVICE_ROLE_KEY`. La clave `service_role` omite RLS; por tanto, son las rutas Express y sus filtros por `usuario_id` las que deben validar cada operación. Nunca incluyas esa clave en frontend, documentación pública o repositorios.
- `supabase_auth_migration.sql` y `supabase_rls.sql` definen políticas distintas para las tablas financieras. En particular, una compara `auth_id` o `id` con el usuario autenticado y la otra compara directamente `usuario_id` con `auth.uid()`. No asumas que ambas son intercambiables.
- `tramites_migration.sql` crea `tramites_admin_policy` con `using (true)` y `with check (true)` para `authenticated`. Eso no restringe filas por propietario ni rol. Debe revisarse antes de usar RLS como barrera de acceso.
- `auditoria_admin_read_policy` solo concede lectura a administradores y no define una política de inserción para usuarios normales. El servicio backend con `service_role` puede insertar igualmente porque omite RLS.
- Si una credencial real llegó a GitHub, borrar `.env` del último commit no la elimina de commits anteriores. Rótala en el proveedor correspondiente y, si GitHub bloquea un push, elimina el secreto del historial que se va a publicar.

### Variables de conexión

El backend Supabase requiere `SUPABASE_URL` y `SUPABASE_SERVICE_ROLE_KEY` en el entorno del servidor. El adaptador opcional SQL Server lee `DB_USER`, `DB_PASSWORD`, `DB_SERVER`, `DB_NAME`, `DB_PORT`, `DB_ENCRYPT` y `DB_TRUST_SERVER_CERTIFICATE`. No copies valores reales a esta guía; documenta únicamente nombres de variables y usa `.env.example` con marcadores no secretos.

### Comprobación del esquema remoto

Antes de desplegar cambios, confirma en Supabase que existen todas las tablas y columnas que consultan las rutas. Revisa claves foráneas, índices, políticas RLS y que `usuarios.auth_id` vincule cada perfil al UUID de Auth. Esta revisión es especialmente importante porque los scripts del repositorio no crean todas las tablas activas y las dos variantes de política de propietario no son idénticas.
