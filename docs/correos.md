# Correo transaccional de Notaire

Notaire centraliza sus correos propios en `src/app/services/email.service.js` y utiliza el SDK oficial de Resend. Los recordatorios, avisos financieros, mensajes de cuenta y confirmaciones existentes pasan por ese servicio; no se guardan contraseñas ni tokens en las plantillas ni en los registros.

La recuperación de contraseña continúa a cargo de Supabase Auth mediante `resetPasswordForEmail`. Ese flujo genera y valida los enlaces de recuperación, por lo que no se debe reemplazar ni enviar un enlace propio desde Resend.

## Desactivar correo temporalmente

Para desplegar sin notificaciones por correo, configura `EMAIL_MODE=disabled`. En este modo el servicio no importa ni inicializa Resend, no requiere `RESEND_API_KEY`, `MAIL_FROM`, dominio verificado ni `PUBLIC_APP_URL`, y toda petición de envío devuelve `false` sin registrarse como enviada. Las notificaciones internas de la aplicación y sus rutas no dependen de este ajuste. La recuperación de contraseña administrada por Supabase Auth conserva su configuración independiente.

`npm run email:test` indicará que el correo está desactivado y no realizará ningún envío.

En Vercel conserva `EMAIL_MODE=disabled` y elimina las variables de Resend (`EMAIL_PROVIDER`, `RESEND_API_KEY`, `MAIL_FROM`, `MAIL_TEST_RECIPIENT` y `PUBLIC_APP_URL`) mientras el correo esté apagado.

## Configuración de desarrollo

1. Crea una cuenta en [Resend](https://resend.com/) y genera una API Key desde **API Keys**.
2. Copia `.env.example` a `.env` y completa:

   ```dotenv
   EMAIL_PROVIDER=resend
   EMAIL_MODE=development
   RESEND_API_KEY=re_...
   MAIL_FROM="Notaire <onboarding@resend.dev>"
   MAIL_TEST_RECIPIENT=tu-correo-autorizado@ejemplo.com
   PUBLIC_APP_URL=http://localhost:3000
   ```

3. Con el remitente de prueba `onboarding@resend.dev`, Resend limita los envíos al destinatario autorizado de la cuenta de Resend (normalmente el correo con el que se registró). Configura ese mismo correo en `MAIL_TEST_RECIPIENT`. Verifica las restricciones vigentes en la documentación de Resend.
4. En modo desarrollo todos los mensajes se redirigen únicamente a `MAIL_TEST_RECIPIENT`, aunque el evento original pertenezca a otra cuenta. Sin remitente, API Key o destinatario de prueba configurados, los envíos quedan desactivados y el servidor indica las variables faltantes.

`.env` y los archivos `.env.*` locales están excluidos de Git. No copies credenciales a código, frontend, documentación o registros.

## Comprobar y enviar un correo de prueba

```bash
npm run email:test
```

Valida la configuración local sin enviar. Para comprobar la conexión real con Resend, su aceptación del mensaje y la entrega al destinatario autorizado:

```bash
npm run email:test -- --send
```

El segundo comando envía un correo real, solo en modo desarrollo y al destinatario configurado en `MAIL_TEST_RECIPIENT`. El resultado solo se declara satisfactorio cuando la API responde con un ID de correo. Resend no ofrece una comprobación de conexión que pruebe la entrega sin enviar un mensaje.

También se ejecutan pruebas locales sin llamadas de red:

```bash
npm test
```

Estas pruebas verifican la redirección, los destinatarios de producción, la validación, las plantillas y los errores de Resend.

## Preparar producción

Antes de habilitar los envíos:

1. Añade tu dominio en **Resend → Domains** y completa los registros DNS indicados por Resend.
2. Espera la verificación del dominio y usa únicamente un remitente perteneciente a ese dominio verificado.
3. En el entorno de despliegue configura las variables como secretos del servidor:

   ```dotenv
   EMAIL_PROVIDER=resend
   EMAIL_MODE=production
   RESEND_API_KEY=re_...
   MAIL_FROM="Notaire <notificaciones@correo.midominio.com>"
   PUBLIC_APP_URL=https://www.midominio.com
   ```

4. Reinicia el servidor. Al reactivar el correo en producción, el proceso no inicia con variables faltantes, formato inválido, una URL que no use HTTPS o el remitente `onboarding@resend.dev`.
5. Realiza una prueba desde el entorno desplegado y verifica el ID/estado en el panel de Resend. No se redirigen los destinatarios legítimos en producción.

No uses `MAIL_TEST_RECIPIENT` como mecanismo de redirección en producción. La recuperación de contraseña mantiene el proveedor y las plantillas configurados en Supabase Auth.

## Diagnóstico

- **“Correo inactivo; configura…”**: completa los nombres de variable indicados y reinicia el proceso.
- **Resend 401/403**: revisa la API Key, su estado/permisos y que sea un secreto del backend.
- **Remitente o dominio no verificado**: verifica el dominio y los registros DNS en Resend; `onboarding@resend.dev` solo sirve para el modo de prueba permitido.
- **Destinatario de prueba rechazado**: confirma que `MAIL_TEST_RECIPIENT` sea la dirección autorizada por Resend para el remitente de prueba.
- **Resend rechaza el mensaje**: revisa el detalle de la respuesta en la consola del servidor y el registro de eventos en Resend. Los errores nunca se confirman como envíos exitosos.
- **No llegan correos de recuperación**: revisa las plantillas, SMTP y límites de correo en Supabase Auth; esos mensajes no los envía este servicio de Resend.

La API Key compartida previamente debe revocarse y reemplazarse antes de usarla en producción. Nunca la vuelvas a pegar en conversaciones ni la guardes en un archivo versionado.
