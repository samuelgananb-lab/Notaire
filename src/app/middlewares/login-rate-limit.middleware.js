import { createHmac } from 'node:crypto';
import { supabase } from '../database/supabase.js';
import { JWT_SECRET } from './auth.middleware.js';

function readLimit(name, fallback, minimum, maximum) {
  const raw = process.env[name];
  if (raw === undefined || raw === '') return fallback;
  const value = Number(raw);
  if (!Number.isSafeInteger(value) || value < minimum || value > maximum) {
    throw new Error(`${name} debe ser un entero entre ${minimum} y ${maximum}.`);
  }
  return value;
}

const limits = Object.freeze({
  ipAttempts: readLimit('LOGIN_RATE_LIMIT_IP_MAX', 30, 1, 10000),
  accountAttempts: readLimit('LOGIN_RATE_LIMIT_ACCOUNT_MAX', 5, 1, 1000),
  windowSeconds: readLimit('LOGIN_RATE_LIMIT_WINDOW_SECONDS', 900, 60, 86400)
});
const MAX_LOCAL_BUCKETS = 10000;
let localFallbackWarningShown = false;

function hashIdentifier(value) {
  return createHmac('sha256', JWT_SECRET).update(value).digest('hex');
}

export function createLocalAttemptLimiter({ now = Date.now, maxBuckets = MAX_LOCAL_BUCKETS } = {}) {
  const buckets = new Map();

  return function consumeLocalAttempt({ ipHash, accountHash, ipAttempts, accountAttempts, windowSeconds }) {
    const timestamp = now();
    const windowMs = windowSeconds * 1000;
    for (const [key, bucket] of buckets) {
      if (timestamp - bucket.startedAt >= windowMs) buckets.delete(key);
    }

    const scopes = [
      { key: `ip:${ipHash}`, maxAttempts: ipAttempts }
    ];
    if (accountHash) scopes.push({ key: `account:${accountHash}`, maxAttempts: accountAttempts });

    let allowed = true;
    let retryAfterSeconds = 0;
    for (const scope of scopes) {
      let bucket = buckets.get(scope.key);
      if (!bucket) {
        if (buckets.size >= maxBuckets) {
          return { allowed: false, retry_after_seconds: windowSeconds };
        }
        bucket = { startedAt: timestamp, attempts: 0 };
        buckets.set(scope.key, bucket);
      }
      bucket.attempts += 1;
      if (bucket.attempts > scope.maxAttempts) {
        allowed = false;
        retryAfterSeconds = Math.max(
          retryAfterSeconds,
          Math.ceil((bucket.startedAt + windowMs - timestamp) / 1000)
        );
      }
    }

    return { allowed, retry_after_seconds: Math.max(0, retryAfterSeconds) };
  };
}

const consumeLocalAttempt = createLocalAttemptLimiter();

async function consumeAttempt({ ipHash, accountHash, ...configuredLimits }) {
  const { data, error } = await supabase.rpc('consume_login_attempt', {
    p_ip_hash: ipHash,
    p_account_hash: accountHash,
    p_ip_max_attempts: configuredLimits.ipAttempts,
    p_account_max_attempts: configuredLimits.accountAttempts,
    p_window_seconds: configuredLimits.windowSeconds
  });
  if (error) {
    const failure = new Error('No se pudo consultar la protección de inicio de sesión.');
    failure.code = error.code;
    throw failure;
  }
  return data;
}

export function createLoginRateLimit({
  consume = consumeAttempt,
  localConsume = consumeLocalAttempt,
  config = limits,
  allowLocalFallback = process.env.NODE_ENV !== 'production',
  logger = console
} = {}) {
  return async function loginRateLimit(req, res, next) {
    const ip = String(req.ip || req.socket?.remoteAddress || '').trim().slice(0, 128);
    if (!ip) {
      return res.status(503).json({ error: 'El inicio de sesión no está disponible temporalmente. Inténtalo más tarde.' });
    }

    const email = typeof req.body?.email === 'string'
      ? req.body.email.trim().toLowerCase().slice(0, 320)
      : '';
    const hashes = {
      ipHash: hashIdentifier(`ip:${ip}`),
      accountHash: email ? hashIdentifier(`account:${email}`) : null
    };

    let result;
    try {
      result = await consume({ ...hashes, ...config });
    } catch (error) {
      if (error.code === 'PGRST202' && allowLocalFallback) {
        if (!localFallbackWarningShown) {
          logger.warn('Falta consume_login_attempt; usando un límite local solo para desarrollo. Aplica login_rate_limit_migration.sql para compartir el límite entre procesos.');
          localFallbackWarningShown = true;
        }
        try {
          result = localConsume({ ...hashes, ...config });
        } catch {
          return res.status(503).json({ error: 'El inicio de sesión no está disponible temporalmente. Inténtalo más tarde.' });
        }
      } else {
        logger.error('Falló la protección de inicio de sesión.', error.code || error.name || 'unknown');
        return res.status(503).json({ error: 'El inicio de sesión no está disponible temporalmente. Inténtalo más tarde.' });
      }
    }

    if (typeof result?.allowed !== 'boolean') {
      logger.error('La protección de inicio de sesión devolvió una respuesta inválida.');
      return res.status(503).json({ error: 'El inicio de sesión no está disponible temporalmente. Inténtalo más tarde.' });
    }

    if (!result.allowed) {
      const retryAfter = Math.max(1, Math.ceil(Number(result.retry_after_seconds) || config.windowSeconds));
      res.set('Retry-After', String(retryAfter));
      return res.status(429).json({ error: 'Demasiados intentos. Espera antes de volver a intentar.' });
    }

    return next();
  };
}

export const loginRateLimit = createLoginRateLimit();
