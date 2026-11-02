import dotenv from 'dotenv';

dotenv.config();

const DEV_SENDER = 'onboarding@resend.dev';

function extractAddress(value = '') {
  const match = String(value).match(/<([^<>]+)>/);
  return (match ? match[1] : value).trim().toLowerCase();
}

function isEmail(value) {
  return /^[^\s<>@]+@[^\s<>@]+\.[^\s<>@]+$/.test(String(value || '').trim());
}

function getEmailConfiguration(env = process.env) {
  const provider = String(env.EMAIL_PROVIDER || 'resend').trim().toLowerCase();
  const mode = String(env.EMAIL_MODE || 'development').trim().toLowerCase();
  const sender = String(env.MAIL_FROM || '').trim();
  const senderAddress = extractAddress(sender);
  const missing = [];
  const issues = [];

  if (!['development', 'production', 'disabled'].includes(mode)) {
    issues.push('EMAIL_MODE debe ser development, production o disabled.');
  }

  if (mode !== 'disabled') {
    if (provider !== 'resend') issues.push('EMAIL_PROVIDER debe ser resend.');
    if (!env.RESEND_API_KEY?.trim()) missing.push('RESEND_API_KEY');
    if (!sender) missing.push('MAIL_FROM');
    else if (!isEmail(senderAddress)) issues.push('MAIL_FROM no contiene una dirección válida.');

    if (mode === 'development') {
      if (!env.MAIL_TEST_RECIPIENT?.trim()) missing.push('MAIL_TEST_RECIPIENT');
      else if (!isEmail(env.MAIL_TEST_RECIPIENT)) issues.push('MAIL_TEST_RECIPIENT no es una dirección válida.');
      if (senderAddress && senderAddress !== DEV_SENDER) {
        issues.push(`En desarrollo MAIL_FROM debe usar ${DEV_SENDER}.`);
      }
    }

    if (mode === 'production') {
      if (senderAddress === DEV_SENDER) issues.push('El remitente onboarding@resend.dev no se permite en producción.');
      if (!env.PUBLIC_APP_URL?.trim()) missing.push('PUBLIC_APP_URL');
    }

    if (env.PUBLIC_APP_URL?.trim()) {
      try {
        const appUrl = new URL(env.PUBLIC_APP_URL);
        if (!['http:', 'https:'].includes(appUrl.protocol)) issues.push('PUBLIC_APP_URL debe usar HTTP o HTTPS.');
        if (mode === 'production' && appUrl.protocol !== 'https:') issues.push('PUBLIC_APP_URL debe usar HTTPS en producción.');
      } catch {
        issues.push('PUBLIC_APP_URL no es una URL válida.');
      }
    }
  }

  return {
    provider,
    mode,
    sender,
    senderAddress,
    testRecipient: String(env.MAIL_TEST_RECIPIENT || '').trim().toLowerCase(),
    appUrl: String(env.PUBLIC_APP_URL || 'http://localhost:3000').trim().replace(/\/+$/, ''),
    missing: [...new Set(missing)],
    issues,
    ready: mode !== 'disabled' && missing.length === 0 && issues.length === 0,
    disabled: mode === 'disabled'
  };
}

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function renderEmailHtml({ subject, text, appUrl }) {
  const logoUrl = `${appUrl}/auth/assets/img/notaire-auth-logo.svg`;
  const safeSubject = escapeHtml(subject);
  const safeText = escapeHtml(text);

  return `<!doctype html>
<html lang="es">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${safeSubject}</title></head>
<body style="margin:0;padding:24px 12px;background:#f4f1f8;font-family:Arial,Helvetica,sans-serif;color:#292333">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:600px;margin:0 auto;background:#fff;border:1px solid #e8e1ef;border-radius:16px;overflow:hidden">
    <tr><td style="padding:28px 32px 20px;text-align:center;background:#160d22">
      <img src="${logoUrl}" width="54" height="54" alt="Notaire" style="display:block;width:54px;height:54px;margin:0 auto 10px">
      <div style="font-size:20px;font-weight:700;letter-spacing:.3px;color:#fff">Notaire</div>
    </td></tr>
    <tr><td style="padding:30px 32px 34px">
      <h1 style="margin:0 0 18px;font-size:21px;line-height:1.35;color:#342044">${safeSubject}</h1>
      <div style="font-size:15px;line-height:1.7;color:#50485a;white-space:pre-line">${safeText}</div>
      <p style="margin:28px 0 0"><a href="${escapeHtml(appUrl)}" style="display:inline-block;padding:12px 20px;border-radius:8px;background:#7d2bd1;color:#fff;text-decoration:none;font-size:14px;font-weight:700">Abrir Notaire</a></p>
    </td></tr>
    <tr><td style="padding:16px 32px;background:#faf8fc;border-top:1px solid #eee8f3;color:#7a7182;font-size:12px;line-height:1.5;text-align:center">Este mensaje fue enviado por Notaire. Si no reconoces esta actividad, contacta al equipo de soporte.</td></tr>
  </table>
</body>
</html>`;
}

export function createEmailService({
  env = process.env,
  resendFactory = async apiKey => {
    const { Resend } = await import('resend');
    return new Resend(apiKey);
  },
  logger = console
} = {}) {
  const config = getEmailConfiguration(env);
  let resendClient;

  if (config.mode === 'production' && !config.ready) {
    throw new Error(`Configuración de correo de producción inválida: ${[...config.missing, ...config.issues].join(' ')}`);
  }

  if (config.disabled) {
    logger.info('Correo de Notaire desactivado (EMAIL_MODE=disabled).');
  } else if (!config.ready) {
    const details = [...config.missing.map(name => `falta ${name}`), ...config.issues].join('; ');
    logger.warn(`Correo de Notaire inactivo (${config.mode}): ${details}`);
  }

  async function send({ to, subject, text, idempotencyKey }) {
    if (config.disabled) return false;
    if (!config.ready) return false;
    if (typeof subject !== 'string' || !subject.trim() || typeof text !== 'string' || !text.trim()) {
      throw new Error('El asunto y el contenido del correo son obligatorios.');
    }
    if (/[\r\n]/.test(subject)) throw new Error('El asunto del correo no puede contener saltos de línea.');
    if (idempotencyKey !== undefined &&
      (typeof idempotencyKey !== 'string' || !idempotencyKey.trim() || idempotencyKey.length > 256)) {
      throw new Error('La clave idempotente del correo no es válida.');
    }

    const recipients = Array.isArray(to) ? to : [to];
    if (!recipients.length || recipients.some(recipient => !isEmail(recipient))) {
      throw new Error('El destinatario del correo no es válido.');
    }

    const destinations = config.mode === 'development'
      ? [config.testRecipient]
      : [...new Set(recipients.map(recipient => String(recipient).trim().toLowerCase()))];
    if (config.mode === 'development' && destinations[0] !== config.testRecipient) {
      throw new Error('El destinatario de desarrollo no está autorizado.');
    }

    resendClient ||= await resendFactory(env.RESEND_API_KEY.trim());
    const emailSubject = `Notaire | ${subject.trim()}`;
    const email = {
      from: config.sender,
      to: destinations,
      subject: emailSubject,
      text,
      html: renderEmailHtml({ subject: emailSubject, text, appUrl: config.appUrl })
    };
    const response = idempotencyKey
      ? await resendClient.emails.send(email, { idempotencyKey })
      : await resendClient.emails.send(email);
    const { data, error } = response;

    if (error) throw new Error(`Resend rechazó el correo: ${error.message || 'error sin detalle'}`);
    if (!data?.id) throw new Error('Resend no confirmó el envío del correo.');

    logger.info(`Correo enviado por Resend (${config.mode}); id=${data.id}`);
    return true;
  }

  return {
    send,
    getStatus: () => ({
      provider: config.provider,
      mode: config.mode,
      ready: config.ready,
      disabled: config.disabled,
      missing: [...config.missing],
      issues: [...config.issues]
    })
  };
}

const emailService = createEmailService();

export const getEmailStatus = emailService.getStatus;

export async function sendAppEmail(message) {
  return emailService.send(message);
}

export { DEV_SENDER, getEmailConfiguration, isEmail, renderEmailHtml };
