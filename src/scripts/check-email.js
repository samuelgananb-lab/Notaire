import { getEmailStatus, sendAppEmail } from '../app/services/email.service.js';

const status = getEmailStatus();

if (!status.ready) {
  console.error('La configuración de correo no está lista:');
  for (const item of [...status.missing.map(name => `Falta ${name}`), ...status.issues]) {
    console.error(`- ${item}`);
  }
  process.exitCode = 1;
} else if (status.mode !== 'development') {
  console.error('La prueba de envío solo se permite en EMAIL_MODE=development.');
  process.exitCode = 1;
} else if (!process.argv.includes('--send')) {
  console.log('Configuración válida. Para enviar un correo real al destinatario de prueba, ejecuta: npm run email:test -- --send');
} else {
  try {
    const sent = await sendAppEmail({
      to: process.env.MAIL_TEST_RECIPIENT,
      subject: 'Prueba de correo de Notaire',
      text: `Este es un mensaje de prueba solicitado desde el entorno de desarrollo.\nFecha: ${new Date().toLocaleString('es-CO')}`
    });

    if (!sent) {
      console.error('Resend no confirmó el envío de prueba.');
      process.exitCode = 1;
    } else {
      console.log('Resend confirmó satisfactoriamente el envío al destinatario autorizado de prueba.');
    }
  } catch (error) {
    console.error(`Falló la prueba de correo: ${error.message}`);
    process.exitCode = 1;
  }
}
